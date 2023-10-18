open Lwt.Infix
open Websocket

let fail_if eq f = if eq then f () else Lwt.return_unit

module Mirage_websocket
  (P: Mirage_clock.PCLOCK)
  (Res: Resolver_mirage.S)
  (Conn : Conduit_mirage.S)
= struct
  module Channel = Mirage_channel.Make (Conn.Flow)
  module IO = Cohttp_mirage.IO (Channel)
  module WS = Websocket.Make (IO)
  module Endpoint = Conduit_mirage.Endpoint (P)

  exception Connection_error of string
  let connection_error msg = Lwt.fail @@ Connection_error msg
  let protocol_error msg = Lwt.fail @@ Protocol_error msg

  let upgrade_headers headers key =
    Cohttp.Header.add_list headers [
      "Upgrade", "websocket";
      "Connection", "Upgrade";
      "Sec-Websocket-Key", key;
      "Sec-Websocket-Version", "13";
    ]

  let do_handshake headers url ch key =
    let headers = upgrade_headers headers key in
    let req = Cohttp.Request.make ~headers url in
    WS.Request.write (fun _w -> Lwt.return_unit) req ch
    >>= fun () ->
      (WS.Response.read ch >>= function
      | `Ok r -> Lwt.return r
      | `Eof -> connection_error "Connection closed during handshake"
      | `Invalid s -> protocol_error @@ "Invalid handshake: " ^ s)
    >>= fun response ->
      let open Cohttp.Code in
      let status = Cohttp.Response.status response in
      Logs.debug (fun m ->
        m "Handshake response: %s%!" @@ string_of_status status);
      fail_if
        (is_error @@ code_of_status status)
        (fun () -> connection_error @@ string_of_status status)

  let do_connect resolver con uri =
    Res.resolve_uri ~uri resolver
    >>= fun endp ->
      Logs.debug (fun m -> m "Connecting to %s" @@ Uri.to_string uri);
      Endpoint.client endp
    >>= fun client -> Conn.connect con client
    >|= fun flow -> flow, Channel.create flow

  type conn = {
    read_frame : unit -> Frame.t Lwt.t;
    write_frame : Frame.t -> unit Lwt.t;
    ch : IO.oc;
    close: unit -> unit Lwt.t;
  }

  let read conn = conn.read_frame ()
  let write conn frame = conn.write_frame frame
  let close conn = conn.close

  let connect_ws resolver con uri headers key =
    let uri = Uri.of_string uri in
    do_connect resolver con uri
    >>= fun (_flow, ch) ->
      Lwt.catch
        (fun () -> do_handshake headers uri ch key)
        (fun exn -> Lwt.fail exn)
    >|= fun () ->
      Logs.debug (fun m -> m "Connected to %s" @@ Uri.to_string uri);
      ch

  let connect ?(rng = Websocket.Rng.init ()) resolver con uri headers =
    let open WS in
    let key = Base64.encode_exn (rng 16) in
    connect_ws resolver con uri headers key
    >|= fun ch ->
      let read_frame = make_read_frame ?buf:None ~mode:(Client rng) ch ch in
      let read_frame () = Lwt.catch read_frame Lwt.fail in
      let buf = Buffer.create 128 in
      let write_frame frame =
        Logs.debug (fun m -> m "Writing frame: %s" @@ Frame.show frame);
        Buffer.clear buf;
        Lwt.wrap2 (write_frame_to_buf ~mode:(Client rng)) buf frame
        >>= fun() ->
          let buf = Buffer.contents buf in
          Lwt.catch
            (fun () -> IO.write ch buf >>= fun () -> IO.flush ch)
            Lwt.fail
      in
      let close () = Channel.close ch >>= fun r -> r |> function
      | Ok () -> Lwt.return_unit
      | Error _ -> connection_error "Error closing channel"
      in
      {read_frame; write_frame; ch; close}

  let make_text_frame content =
    Frame.create ~opcode:Frame.Opcode.Text ~content ()

  let make_pong_frame content =
    Frame.create ~opcode:Frame.Opcode.Pong ~content ()

  let start conn handler =
    let handler frame =
      let open Frame in
      Logs.debug (fun m -> m "Received frame: %s" @@ Frame.show frame);
      match frame.opcode with
      | Opcode.Close -> connection_error "connection closed"
      | Opcode.Text -> Logs.app (fun m -> m "%s" frame.content);handler frame.content
      | Opcode.Ping -> make_pong_frame frame.content |> write conn
      | _ ->
        Logs.debug (fun m -> m "Received unknown frame");
        Lwt.return_unit in
    let rec loop () = conn.read_frame () >>= handler >>= loop in
    Lwt.catch
      loop
      (fun exn ->
        Logs.err (fun m -> m "Error while reading: %s" @@ Printexc.to_string exn);
        conn.close () |> Lwt.ignore_result;
        Lwt.fail exn)
end

module Message = struct
  type t = {
    topic: string;
    path: string;
    value: Yojson.Basic.t;
    corr_id: string option;
    status: int option;
  }

  let new_corr_id n =
    let src = "abcdefghijklmnopqrstuvwxyz1234567890" in
    let len = String.length src in
    String.init n (fun _ -> Random.int len |> String.get src)

  let create actor name value =
    let topic = actor ^ "/things/live/messages/" ^ name in
    let path = "/inbox/messages/" ^ name in
    let corr_id = new_corr_id 16 in
    { topic; path; value; corr_id = Some corr_id; status = None }

  let of_string msg = try
    let open Yojson.Basic.Util in
    let json = Yojson.Basic.from_string msg in
    let topic = json |> member "topic" |> to_string in
    let path = json |> member "path" |> to_string in
    let value = json |> member "value" in
    let corr_id = json |> member "headers" |> member "correlation-id" |> to_string_option in
    Some { topic; path; value; corr_id; status = None}
  with exn ->
    Logs.warn (fun m -> m "Recevied invalid message: %s %s"
      msg @@ Printexc.to_string exn);
    None

  let to_string msg =
    let corr_id = match msg.corr_id with
    | Some id -> id
    | None -> new_corr_id 16 in
    let status = match msg.status with
    | Some status -> `Int status
    | None -> `Null in
      `Assoc [
        "topic", `String msg.topic;
        "path", `String msg.path;
        "value", msg.value;
        "headers", `Assoc [
          "content-type", `String "application/json";
          "correlation-id", `String corr_id;
        ];
        "status", status;
      ]
    |> Yojson.Basic.to_string

  let respond msg ?(status = 200) value = {
    msg with value;
    topic = Stringext.replace_all msg.topic ~pattern:"inbox" ~with_:"outbox";
    path = Stringext.replace_all msg.path ~pattern:"inbox" ~with_:"outbox";
    status = Some status
  }

  let topic msg = msg.topic
  let path msg = msg.path
  let value msg = msg.value
  let corr_id msg = msg.corr_id
  let status msg = msg.status

  let short_topic msg =
    let rec last_item = function
    | [] -> failwith "Empty list"
    | [a] -> a
    | _ :: t -> last_item t 
    in
    msg.topic |> String.split_on_char '/' |> last_item
end

module Actor = struct
  module Store = Map.Make (String)
  type state = [
    `Default | `Others
  ]

  let default_state = `Default

  type t = {
    state: state;
    store: (Message.t Lwt.u) Store.t;
    name: string;
    tell: Message.t -> unit Lwt.t;
    ask: t -> Message.t -> t * (Message.t Lwt.t);
  }

  let state s = s.state
  let store s = s.store
  let name s = s.name
  let tell s msg = s.tell msg
  let ask s msg = s.ask msg

  let create store name send =
    let ask s msg = match msg.Message.corr_id with
    | None -> {s with store}, Lwt.fail @@ Failure "No correlation id"
    | Some id -> let future, resolve = Lwt.task () in
      send msg |> Lwt.ignore_result;
      {s with store = Store.add id resolve store}, future
    in
    {state = default_state; store; name; tell = send; ask}

  let check_reply s msg =
    match msg.Message.corr_id with
    | None -> s.store, false
    | Some id -> Store.find_opt id s.store |> function
      | Some resolve ->
        Lwt.wakeup_later resolve msg;
        Store.remove id s.store, true
      | None -> s.store, false

  let check_prefix prefix topic =
    String.starts_with ~prefix topic

  let check s raw_msg = Message.of_string raw_msg |> function
  | None -> s, None
  | Some msg ->
    check_reply s msg |> function
    | store, true -> {s with store}, None
    | _, false ->
      if check_prefix s.name msg.topic then s, Some (msg)
      else s, None

  let on_unknown s msg =
    let topic = Message.short_topic msg in
    let msg = Message.to_string msg in
    Logs.app (fun m -> m "Received unknown message: %s %s" topic msg);
    Lwt.return s
end

module Transition = struct
  type t = {
    topic: string;
    from: Actor.state;
    to_: Actor.state;
    guard: (Actor.t -> Message.t -> bool) option;
    action: (Actor.t -> Message.t -> Actor.t Lwt.t) option;
  }

  let create ?guard ?action topic from to_ = {
    topic; from; to_; guard; action
  }

  let accept t s msg =
    let b1 = Actor.state s == t.from in
    let b2 = String.equal (Message.short_topic msg) t.topic in
    let b3 = match t.guard with
    | None -> true
    | Some guard -> guard s msg
  in b1 && b2 && b3

  let handle t s msg =
    match t.action with
    | None -> Lwt.return {s with Actor.state = t.to_}
    | Some action -> action s msg >|= fun s -> {s with Actor.state = t.to_}
end

module Client
  (P: Mirage_clock.PCLOCK)
  (Res: Resolver_mirage.S)
  (Conn : Conduit_mirage.S)
= struct
  module WS = Mirage_websocket (P) (Res) (Conn)  

  let auth_of auth_str = String.split_on_char ':' auth_str |> function
  | [auth] -> `Other auth
  | [user; pass] -> `Basic (user, pass)
  | _ -> failwith "Invalid auth"

  let with_auth auth_str headers = auth_of auth_str |>
    Cohttp.Header.add_authorization headers

  let on_start s =
    Logs.app (fun m -> m "Starting %s" @@ Actor.name !s);
    Lwt.return_unit

  let make_handler id send transitions =
    let store = Actor.Store.empty in
    let state = Actor.create store id send |> ref in
    let handle s msg =
      List.find_opt (fun t -> Transition.accept t s msg) transitions |> function
      | None -> Actor.on_unknown s msg
      | Some t -> Transition.handle t s msg 
    in
    let update raw_msg = Actor.check !state raw_msg |> function
    | s, Some (msg) ->
      handle s msg >|= fun s -> state := s
    | s, None ->
      state := s; Lwt.return_unit
    in
    on_start state >|= fun() -> update

  let transtion_update s msg =
    Logs.app (fun m -> m "Received message %s" @@ Message.to_string msg); Lwt.return s

  let start _pclock resolver con =
    let uri = Key_gen.uri () in
    let id = Key_gen.id () in
    let auth = Key_gen.auth () in
    let headers = Cohttp.Header.init () |> with_auth auth in
    let transitions = [
      Transition.create ?action:(Some transtion_update) "update" `Default `Default ;
    ] in
    WS.connect resolver con uri headers
    >>= fun conn ->
      ("START-SEND-MESSAGES" |> WS.make_text_frame |> WS.write conn) <&>
      ("START-SEND-LIVE-COMMANDS" |> WS.make_text_frame |> WS.write conn)
    >>= fun () ->
      let send msg =
        Logs.app (fun m -> m "Sending message %s" @@ Message.to_string msg);
        msg |> Message.to_string |> WS.make_text_frame |> WS.write conn
      in
      make_handler id send transitions
    >>= WS.start conn
end

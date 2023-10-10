open Mirage

let uri =
  let doc = Key.Arg.info ~doc:"URL to fetch" [ "uri" ] in
  Key.(create "uri" Arg.(opt ~stage:`Run string "http://10.0.0.1:31181/ws/2" doc))

let auth =
  let doc = Key.Arg.info ~doc:"WS endpoint auth" [ "auth" ] in
  Key.(create "auth" Arg.(opt ~stage:`Run string "ditto:ditto" doc))

let actor =
  let doc = Key.Arg.info ~doc:"Thing ID" [ "id" ] in
  Key.(create "id" Arg.(opt ~stage:`Run string "org.i2ec/led-indicator" doc))

let client =
  let packages = [
    package "cohttp-mirage";
    package "duration";
    package "websocket";
    package "yojson";
  ] in
  main ~keys:[ Key.v uri; Key.v actor; Key.v auth ] ~packages "Unikernel.Client" @@ pclock @-> resolver @-> conduit @-> job

let () =
  let stack = generic_stackv4v6 default_network in
  let res_dns = resolver_dns stack in
  let conduit = conduit_direct ~tls:true stack in

  let job = [ client $ default_posix_clock $ res_dns $ conduit ] in
  register "mirage-actor" job

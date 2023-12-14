import { CapacityOptions, Capacities } from "@actors/core";
import * as webcam from "node-webcam";

type CapturePayload = null;
type CaptureResult = {
  img: string;
  format: string;
};

const TMP_PATH = "/tmp/__output";
const PIC_POOL_SIZE = 10;
const BASE64_REGEX = /^data:image\/png;base64,/;

class Capture implements CapacityOptions<CapturePayload, CaptureResult> {
  cam: webcam.Webcam;
  format: "jpeg" | "png" | "bmp";

  constructor(format?: "jpeg" | "png" | "bmp") {
    webcam.list(cams => {
      console.log("Available cameras:", cams);
      console.log(`Receiving ${cams.length} cameras, using ${cams[0]}`);
    });
    this.format = format ?? "png";

    this.cam = webcam.create({
      callbackReturn: "base64",
      verbose: false,
      output: this.format
    });
  }

  handle(_: CapturePayload): Promise<CaptureResult> {
    const ret = new Promise<CaptureResult>((resolve, reject) => {
      this.cam.capture(TMP_PATH + Date.now() % PIC_POOL_SIZE, (err, data) => {
        if (err) {
          reject(err);
        } else {
          const img = (data as string).replace(BASE64_REGEX, "");
          resolve({ img, format: this.format });
        }
      });
    });
    return ret;
  }
}

export const capture = Capacities.create("Capture", new Capture());

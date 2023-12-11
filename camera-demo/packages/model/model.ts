import { readFileSync } from "fs";
import { Capacity } from "@actors/core";
import * as tf from "@tensorflow/tfjs-node";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

type Payload = {
  img: string;
  format: string;
};

type Result = {
  pred?: {
    bbox: number[];
    class: string;
    score: number;
  }[];
  err?: string;
};

class ModelCapacity extends Capacity<Payload, Result> {
  override async handle(payload: Payload): Promise<Result> {
    const { img, format } = payload;
    const imageBuffer = Buffer.from(img, "base64");
    let imageTensor;
    if (format == "jpeg") {
      imageTensor = tf.node.decodeJpeg(imageBuffer);
    } else if (format == "png") {
      imageTensor = tf.node.decodePng(imageBuffer);
    } else {
      return {
        err: "Unsupported image format. Only JPEG and PNG are supported."
      };
    }

    // Load the COCO-SSD model
    const model = await cocoSsd.load();
    // Perform object detection
    const predictions = await model.detect(imageTensor);

    // Dispose the tensor to release memory
    tf.dispose(imageTensor);

    return { pred: predictions };
  }

  override preCheck(): boolean {
    const avx = readFileSync("/proc/cpuinfo", "utf8").includes("avx");
    if (!avx) {
      console.warn("AVX not found. Model is not able to run");
      return false;
    }
    return true;
  }
}

export const capacity = new ModelCapacity("Model");

import * as tf from "@tensorflow/tfjs-node";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

const detect = async (data, format) => {
  const imageBuffer = Buffer.from(data, "base64");
  let imageTensor;
  if (format == "jpeg") {
    imageTensor = tf.node.decodeJpeg(imageBuffer);
  } else if (format == "png") {
    imageTensor = tf.node.decodePng(imageBuffer);
  } else {
    throw new Error(
      "Unsupported image format. Only JPEG and PNG are supported."
    );
  }

  // Load the COCO-SSD model
  const model = await cocoSsd.load();
  // Perform object detection
  const predictions = await model.detect(imageTensor);

  // Dispose the tensor to release memory
  tf.dispose(imageTensor);

  return predictions;
};

export { detect };

declare interface DetectInput {
  type: string;
  data: string;
}

declare interface Prediction {
  bbox: number[];
  class: string;
  score: number;
}

declare function detect(img: string, type: string): Promise<Prediction[]>;

export { DetectInput, detect, Prediction };

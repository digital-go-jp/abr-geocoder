import { PrefectureName } from "./prefecture-name";

export type InterpolatePattern = {
  regExpPattern: string;
  prefecture: PrefectureName;
  city?: string;
};
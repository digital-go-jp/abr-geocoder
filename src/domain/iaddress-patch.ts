import { PrefectureName } from "./prefecture-name";

export interface IAddressPatch {
  prefecture: PrefectureName;
  city: string;
  town: string;
  regExpPattern: string;
  result: string;
}
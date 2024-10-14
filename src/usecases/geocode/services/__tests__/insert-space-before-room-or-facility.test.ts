import { DASH, SPACE } from "@config/constant-values";
import { describe, expect, it } from "@jest/globals";
import { CharNode } from "@usecases/geocode/models/trie/char-node";
import { insertSpaceBeforeRoomOrFacility } from "../insert-space-before-room-or-facility";

describe("insertSpaceBeforeRoomOrFacility", () => {
  it("should replace the dash at the room number with a space", () => {
    const target = CharNode.create(`1${DASH}2${DASH}3号室`);
    const result = insertSpaceBeforeRoomOrFacility(target);
    expect(result?.toProcessedString()).toBe(`1${DASH}2${SPACE}3号室`);
  });
  it("should insert a space between a number and a kanji-number", () => {
    const target = CharNode.create(`三輪2–1–1三田市役所`);
    const result = insertSpaceBeforeRoomOrFacility(target);
    expect(result?.toProcessedString()).toBe(`三輪2–1–1${SPACE}三田市役所`);
  });
  it("should replace a dash with a space at 302号室", () => {
    const target = CharNode.create(`南2条西1${DASH}52${DASH}302号室`);
    const result = insertSpaceBeforeRoomOrFacility(target);
    expect(result?.toProcessedString()).toBe(`南2条西1${DASH}52${SPACE}302号室`);
  });
  it("should replace a \"の\" between two numbers", () => {
    const target = CharNode.create(`482の2`);
    const result = insertSpaceBeforeRoomOrFacility(target);
    expect(result?.toProcessedString()).toBe(`482${DASH}2`);
  });
  it("should insert a space before the facility name", () => {
    const target = CharNode.create(`3${DASH}8${DASH}15都営くすのき`);
    const result = insertSpaceBeforeRoomOrFacility(target);
    expect(result?.toProcessedString()).toBe(`3${DASH}8${DASH}15${SPACE}都営くすのき`);
  });
  it("should insert a space before 301C", () => {
    const target = CharNode.create(`西一丁目5${DASH}301C`);
    const result = insertSpaceBeforeRoomOrFacility(target);
    expect(result?.toProcessedString()).toBe(`西一丁目5${SPACE}301C`);
  });
});

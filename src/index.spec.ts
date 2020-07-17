import * as protooClient from "./index";
import * as protooClientPkg from "../package.json";

test("protooClient.version exposes the protoo-client package version", () => {
  expect(typeof protooClient.version).toBe("string");
  expect(protooClient.version).toBe(protooClientPkg.version);
}, 500);

import * as http from "http";
import * as protooServer from "protoo-server";
import { timer, UnaryFunction, Observable } from "rxjs";
import { takeUntil, publish, filter } from "rxjs/operators";
import * as url from "url";
import * as protooClient from "./index";
import { RequestError } from "./Message";
import { AddressInfo } from "net";

let httpServer: http.Server;
let room: protooServer.Room;
let clientPeer: protooClient.Peer<
  protooClient.Request | protooClient.Notification
>;
let serverPeer: protooServer.Peer;
let address: string;

beforeEach(async () => {
  httpServer = http.createServer();

  const wsServer = new protooServer.WebSocketServer(httpServer);

  room = new protooServer.Room();

  await new Promise((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });

  address = `ws://127.0.0.1:${
    (httpServer.address() as AddressInfo).port
  }/?peerId=A`;

  wsServer.on("connectionrequest", async (info, accept, reject) => {
    const u = url.parse(info.request.url!, true);
    const peerId = u.query.peerId as string;

    switch (peerId) {
      case "reject":
        reject(403, "Sorry!");
        break;
      default:
        serverPeer = await room.createPeer(peerId, accept());
    }
  });
});

afterEach(() => {
  if (httpServer) {
    httpServer.close();
  }
  if (clientPeer) {
    clientPeer.complete();
  }
});

test("client connects to server and disconnects", async () => {
  expect(room.peers).toEqual([]);

  const transport = await protooClient.webSocketTransport(address);

  clientPeer = protooClient.Peer.overTransport(transport);

  const clientClosePromise = new Promise((resolve, reject) =>
    clientPeer.subscribe(reject, resolve, reject)
  );

  expect(room.peers).toEqual([serverPeer]);

  // NOTE: Private API to simulate abrupt connection closure.
  // Also, call the public peer.close() to force 'closed: true'.
  (serverPeer as any)._transport._connection.close();
  serverPeer.close();

  expect(serverPeer.closed).toBe(true);
  expect(room.hasPeer("A")).toBe(false);
  expect(room.peers).toEqual([]);

  await clientClosePromise;
});

test("client sends request to server", async () => {
  const transport = await protooClient.webSocketTransport(address);

  clientPeer = protooClient.Peer.overTransport(transport);

  const onServerRequest = jest.fn();

  (serverPeer as any).once("request", (request: any, accept: any) => {
    onServerRequest();

    expect(request.method).toBe("hello");
    expect(request.data).toEqual({ foo: "bar" });

    accept({ text: "hi!" });
  });

  const data = await clientPeer.request("hello", { foo: "bar" });

  expect(onServerRequest).toHaveBeenCalledTimes(1);
  expect(data).toEqual({ text: "hi!" });
});

test("client sends request to server and server rejects it", async () => {
  const transport = await protooClient.webSocketTransport(address);

  clientPeer = protooClient.Peer.overTransport(transport);

  (serverPeer as any).once(
    "request",
    (request: any, accept: any, reject: any) => {
      reject(503, "WHO KNOWS!");
    }
  );

  try {
    await clientPeer.request("hello", { foo: "bar" });
    fail("Unexpected success");
  } catch (error) {
    expect(error.code).toBe(503);
    expect(error.message).toBe("WHO KNOWS!");
  }
});

test("client sends request to server and server throws", async () => {
  const transport = await protooClient.webSocketTransport(address);

  clientPeer = protooClient.Peer.overTransport(transport);

  (serverPeer as any).once("request", () => {
    throw new Error("BOOM!!!");
  });

  try {
    await clientPeer.request("hello", { foo: "bar" });
    fail("unexpected success");
  } catch (error) {
    expect(error.code).toBe(500);
    expect(error.message).toMatch(/BOOM!!!/);
  }
});

test("client sends notification to server", async () => {
  const transport = await protooClient.webSocketTransport(address);

  clientPeer = protooClient.Peer.overTransport(transport);

  const promise = new Promise((resolve) => {
    (serverPeer as any).once(
      "notification",
      (notification: protooServer.ProtooNotification) => {
        expect(notification.method).toBe("hello");
        expect(notification.data).toEqual({ foo: "bar" });

        resolve();
      }
    );
  });

  clientPeer.notify("hello", { foo: "bar" });

  await promise;
});

test("server sends request to client", async () => {
  const transport = await protooClient.webSocketTransport(address);

  clientPeer = protooClient.Peer.overTransport(transport);

  const subscription = clientPeer.subscribe((request) => {
    if (!("request" in request)) {
      fail("unexpected notification");
    }
    expect(request.method).toBe("hello");
    expect(request.data).toEqual({ foo: "bar" });

    clientPeer.next([request, { text: "hi!" }]);
  });

  const data = await serverPeer.request("hello", { foo: "bar" });

  expect(data).toEqual({ text: "hi!" });
});

test("server sends request to client and client rejects it", async () => {
  const transport = await protooClient.webSocketTransport(address);

  clientPeer = protooClient.Peer.overTransport(transport);

  const subscription = clientPeer.subscribe((request) => {
    if ("request" in request) {
      clientPeer.error(new RequestError(request, 503, "WHO KNOWS!"));
    } else {
      fail("Unexpected notification");
    }
  });

  try {
    await serverPeer.request("hello", { foo: "bar" });
    fail("Call succeeded");
  } catch (error) {
    expect(error.code).toBe(503);
    expect(error.message).toBe("WHO KNOWS!");
  }
});

test("server sends notification to client", async () => {
  const transport = await protooClient.webSocketTransport(address);

  clientPeer = protooClient.Peer.overTransport(transport);

  const onClientRequest = jest.fn();

  const promise = new Promise((resolve, reject) => {
    clientPeer.pipe(takeUntil(timer(3000))).subscribe(
      ({ method, data }) => {
        onClientRequest();

        expect(method).toBe("hello");
        expect(data).toEqual({ foo: "bar" });
      },
      reject,
      resolve
    );
  });

  await serverPeer.notify("hello", { foo: "bar" });

  await promise;

  expect(onClientRequest).toHaveBeenCalledTimes(1);
});

test("room.close() closes clientPeer and serverPeer", async () => {
  const transport = await protooClient.webSocketTransport(address);

  clientPeer = protooClient.Peer.overTransport(transport);

  const onServerPeerClose = jest.fn();

  serverPeer.on("close", onServerPeerClose);

  const promise = new Promise((resolve, reject) =>
    clientPeer.subscribe(reject, reject, resolve)
  );

  room.close();

  await promise;

  expect(onServerPeerClose).toHaveBeenCalledTimes(1);
});

test("peer can be piped", async () => {
  const transport = await protooClient.webSocketTransport(address);

  clientPeer = protooClient.Peer.overTransport(transport).pipe(
    filter((message) => "request" in message)
  ) as protooClient.Peer<protooClient.Request>;

  const promise = new Promise((resolve) => {
    (serverPeer as any).once(
      "notification",
      (notification: protooServer.ProtooNotification) => {
        expect(notification.method).toBe("hello");
        expect(notification.data).toEqual({ foo: "bar" });

        resolve();
      }
    );
  });

  clientPeer.notify("hello", { foo: "bar" });

  await promise;
});

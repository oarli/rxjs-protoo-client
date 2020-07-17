# rxjs-protoo-client ![CI](https://github.com/oarli/rxjs-protoo-client/workflows/CI/badge.svg)

A [protoo](https://protoojs.org/) client written with direct RxJS support. Using RxJS results in a substantially smaller bundle size compared to the original `protoo-client`, assuming the client is also using RxJS.

## Installation

```
npm install rxjs-protoo-client
```

## Usage

```ts
import { Peer, webSocketTransport, RequestError } from "rxjs-protoo-client";

const transport = await webSocketTransport(url);

const peer = Peer.overTransport(transport);

// Send a request.
const response = await peer.request("method", {});

// Send a notification.
peer.notify("method", {});

// Listen for requests.
peer.subscribe(
  (message) => {
    if ("request" in message) {
      // Respond to the request.
      peer.next([message, {}]);

      // Alternatively, send an error.
      peer.error(new RequestError(request, 500, "Some error description."));
    } else {
      // Handle the notification.
    }
  },
  (err) => {
    // The peer unexpectedly closed.
  },
  () => {
    // The peer terminated successfully.
  }
);

// Close the connection.
peer.complete();
```

## Differences

Besides the API difference, the one difference with this library is that this library does not auto-retry unexpectedly closed connections. Instead, handle the error and re-establish the peer with a new transport manually.

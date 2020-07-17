export interface Request {
  request: true;
  id: number;
  method: string;
  data?: any;
}

export interface SuccessfulResponse {
  response: true;
  id: number;
  ok: true;
  data: any;
}

export interface FailedResponse {
  response: true;
  id: number;
  ok: false;
  errorCode: number;
  errorReason: string;
}

export type Response = SuccessfulResponse | FailedResponse;

export interface Notification {
  notification: true;
  method: string;
  data?: any;
}

export type Message = Request | Response | Notification;

export class CodedError extends Error {
  constructor(readonly code: number, message?: string) {
    super(message);
  }
}

export class RequestError extends CodedError {
  constructor(
    readonly request: Request,
    readonly code: number,
    message?: string
  ) {
    super(code, message);
  }
}

export function parse(raw: string): Message {
  let object: any;
  const message = {};

  try {
    object = JSON.parse(raw);
  } catch (error) {
    throw new Error("parse() | invalid JSON: " + error);
  }

  if (typeof object !== "object" || Array.isArray(object)) {
    throw new Error("parse() | not an object");
  }

  if (object["request"]) {
    if (typeof object["method"] !== "string") {
      throw new Error("parse() | missing/invalid method field");
    }

    if (typeof object["id"] !== "number") {
      throw new Error("parse() | missing/invalid id field");
    }

    return {
      request: true,
      id: object["id"],
      method: object["method"],
      data: object["data"] || {},
    };
  } else if (object["response"]) {
    if (typeof object["id"] !== "number") {
      throw new Error("parse() | missing/invalid id field");
    }

    if (object["ok"]) {
      return {
        response: true,
        id: object["id"],
        ok: true,
        data: object["data"] || {},
      };
    } else {
      return {
        response: true,
        id: object["id"],
        ok: false,
        errorCode: object["errorCode"],
        errorReason: object["errorReason"],
      };
    }
  } else if (object["notification"]) {
    if (typeof object["method"] !== "string") {
      throw new Error("parse() | missing/invalid method field");
    }

    return {
      notification: true,
      method: object["method"],
      data: object["data"] || {},
    };
  } else {
    throw new Error("parse() | missing request/response field");
  }
}

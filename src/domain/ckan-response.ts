export type CKANResponse<T> =
  | {
      success: false;
    }
  | {
      success: true;
      result: T;
    };

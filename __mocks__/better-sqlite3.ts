export default jest.fn().mockImplementation(
  (
    _: string,
    values: {
      all: undefined;
    }
  ) => {
    return {
      prepare: jest.fn().mockImplementation(() => ({
        all: jest.fn().mockReturnValue(values.all),
      })),
      close: jest.fn(),
    };
  }
);

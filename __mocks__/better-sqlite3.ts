export default jest.fn().mockImplementation(
  () => {
    return {
      inTransaction: false,
      prepare: jest.fn().mockImplementation(() => ({
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
      })),
      close: jest.fn(),
      exec: jest.fn(),
    };
  }
);

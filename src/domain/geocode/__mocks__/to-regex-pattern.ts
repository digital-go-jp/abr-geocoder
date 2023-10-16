export const toRegexPattern = jest.fn().mockImplementation((addr: string) => {
  return addr;
})
import StrResource, { MESSAGE } from '../usecase/strResource';

export enum AbrgErrorLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
};

export class AbrgError extends Error {
  public readonly level: AbrgErrorLevel;
  public readonly messageId: MESSAGE;
  constructor({
    messageId,
    level,
  }: {
    messageId: MESSAGE,
    level: AbrgErrorLevel,
  }) {

    const strResource = StrResource();
    super(
      strResource(messageId),
    );
    this.messageId = messageId;
    this.level = level;
    Object.freeze(this);
  }
}
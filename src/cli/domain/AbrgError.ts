import {AbrgMessage} from './AbrgMessage';

export enum AbrgErrorLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export class AbrgError extends Error {
  public readonly level: AbrgErrorLevel;
  public readonly messageId: AbrgMessage;
  constructor({
    messageId,
    level,
  }: {
    messageId: AbrgMessage;
    level: AbrgErrorLevel;
  }) {
    super(AbrgMessage.toString(messageId));
    this.messageId = messageId;
    this.level = level;
    Object.freeze(this);
  }
}

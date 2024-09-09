import { Hono } from 'hono'
import {AbrGeocoderDiContainer} from "@usecases/geocode/models/abr-geocoder-di-container";
import path from "node:path";
import {upwardFileSearch} from "@domain/services/upward-file-search";
import {AbrgError, AbrgErrorLevel} from "@domain/types/messages/abrg-error";
import {AbrgMessage} from "@domain/types/messages/abrg-message";
import {resolveHome} from "@domain/services/resolve-home";
import {EnvProvider} from "@domain/models/env-provider";

const app = new Hono()

let abrGeocoderDIContainer;

app.get('/',async (c) => {
    const abrgDir = resolveHome(argv.abrgDir || EnvProvider.DEFAULT_ABRG_DIR);
    // ThreadGeocodeTransformで　各スレッドがstdout を使用しようとして、
    // イベントリスナーを取り合いになるため、以下の警告が発生する模様。
    // 動作的には問題ないので、 process.stdout.setMaxListeners(0) として警告を殺す。
    //
    // (node:62246) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
    // 11 unpipe listeners added to [WriteStream]. Use emitter.setMaxListeners() to increase limit
    process.stdout.setMaxListeners(0);
    const rootDir = await upwardFileSearch(__dirname, 'build');
    if (!rootDir) {
        throw new AbrgError({
            messageId: AbrgMessage.CANNOT_FIND_THE_ROOT_DIR,
            level: AbrgErrorLevel.ERROR,
        });
    }

    abrGeocoderDIContainer = new AbrGeocoderDiContainer({
        database: {
            type: 'sqlite3',
            dataDir: path.join(abrgDir, 'database'),
            schemaDir: path.join(rootDir, 'schemas', 'sqlite3'),
        },
        debug: process.env.NODE_ENV === 'development',
    });

    return c.text('Hello Hono!')
})

export default app

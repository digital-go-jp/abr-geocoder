import { Hono } from 'hono'
import {AbrGeocoderDiContainer} from "@usecases/geocode/models/abr-geocoder-di-container";
import path from "node:path";
import {upwardFileSearch} from "@domain/services/upward-file-search";
import {AbrgError, AbrgErrorLevel} from "@domain/types/messages/abrg-error";
import {AbrgMessage} from "@domain/types/messages/abrg-message";
import {resolveHome} from "@domain/services/resolve-home";
import {EnvProvider} from "@domain/models/env-provider";
import {AbrGeocoder} from "@usecases/geocode/abr-geocoder";
import {SearchTarget} from "@domain/types/search-target";
import {Query} from "@usecases/geocode/models/query";
import {OutputFormat} from "@domain/types/output-format";
import { cors } from 'hono/cors'
import { poweredBy } from 'hono/powered-by'

export const app = new Hono()

let geocoder: AbrGeocoder;

app.use(cors())
app.use(poweredBy())

const isSearchTarget = (target: string): target is SearchTarget => {
    return Object.values(SearchTarget).includes(target as SearchTarget);
}

const isFormat = (format: string): format is OutputFormat => {
    return Object.values(OutputFormat).includes(format as OutputFormat);
}

app.get('/geocode',async (c) => {

    const { address, target = SearchTarget.ALL, fuzzy, format = "json" } = c.req.query();
    if (!address) {
        return c.json({
            status: 'error',
            message: 'The address paramaeter is empty',
        }, {
            status: 400,
            statusText: "address is empty"
        });
    }
    if (!isSearchTarget(target)) {
        return c.json({
            status: 'error',
            message: 'The target paramaeter is invalid',
        }, {
            status: 400,
            statusText: "target is invalid"
        });
    }
    if (fuzzy && fuzzy.length !== 1) {
        return c.json({
            status: 'error',
            message: 'The fuzzy paramaeter is invalid',
        }, {
            status: 400,
            statusText: "fuzzy is invalid"
        });
    }

    if (!isFormat(format)) {
        return c.json({
            status: 'error',
            message: 'The format paramaeter is invalid',
        }, {
            status: 400,
            statusText: "format is invalid"
        });
    }

    if (!geocoder) {
        const abrgDir = resolveHome(EnvProvider.DEFAULT_ABRG_DIR);
        const rootDir = await upwardFileSearch(__dirname, 'build');
        if (!rootDir) {
            throw new AbrgError({
                messageId: AbrgMessage.CANNOT_FIND_THE_ROOT_DIR,
                level: AbrgErrorLevel.ERROR,
            });
        }

        const container = new AbrGeocoderDiContainer({
            database: {
                type: 'sqlite3',
                dataDir: path.join(abrgDir, 'database'),
                schemaDir: path.join(rootDir, 'schemas', 'sqlite3'),
            },
            debug: process.env.NODE_ENV === 'development',
        });

        geocoder = new AbrGeocoder({
            container,
            maxConcurrency: 5,
        });
    }

    const result = await geocoder.geocode({
        address,
        tag: undefined,
        searchTarget: target,
        fuzzy,
    });


    const queryResult = Query.from(result);
    return c.json({
        query: {
            input: queryResult.input.data.address,
        },
        result: {
            output: queryResult.formatted.address,
            other: queryResult.tempAddress?.toOriginalString() || "",
            score: queryResult.formatted.score,
            match_level: queryResult.match_level.str,
            coordinate_level: queryResult.coordinate_level.str,
            lat: queryResult.rep_lat,
            lon: queryResult.rep_lon,
            lg_code: queryResult.lg_code ? queryResult.lg_code : "",
            machiaza_id: queryResult.machiaza_id || "",
            rsdt_addr_flg: queryResult.rsdt_addr_flg,
            blk_id: queryResult.block_id || "",
        }
    }, {
        status: 200,
        statusText: "Success"
    })
})

export default app

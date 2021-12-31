import { Run } from "../livesplit-core";
import { PostRunResponse } from "./json/PostRunResponse";
import { GetRunnerPBsResponse } from './json/GetRunnerPBsResponse';

function mapPromiseErr<T, E>(promise: Promise<T>, err: E): Promise<T> {
    return promise.catch((_) => { throw err; });
}

async function validatedFetch<E>(
    input: RequestInfo,
    init: RequestInit | undefined,
    err: E,
): Promise<Response> {
    const r = await mapPromiseErr(
        fetch(input, init),
        err,
    );

    if (!r.ok) {
        throw err;
    }

    return r;
}

export enum UploadError {
    ApiRequestErrored,
    InvalidJsonResponse,
    UploadRequestErrored,
}

export async function uploadLss(lss: string | Blob): Promise<string> {
    const response = await validatedFetch(
        "https://splits.io/api/v4/runs",
        {
            method: "POST",
        },
        UploadError.ApiRequestErrored,
    );

    const json: PostRunResponse = await mapPromiseErr(
        response.json(),
        UploadError.InvalidJsonResponse,
    );

    const claimUri = json.uris.claim_uri;
    const request = json.presigned_request;

    const formData = new FormData();
    const fields = request.fields;

    formData.append("key", fields.key);
    formData.append("policy", fields.policy);
    formData.append("x-amz-credential", fields["x-amz-credential"]);
    formData.append("x-amz-algorithm", fields["x-amz-algorithm"]);
    formData.append("x-amz-date", fields["x-amz-date"]);
    formData.append("x-amz-signature", fields["x-amz-signature"]);
    formData.append("file", lss);

    await validatedFetch(
        request.uri,
        {
            method: request.method,
            body: formData,
        },
        UploadError.UploadRequestErrored,
    );

    return claimUri;
}

export enum DownloadError {
    ApiRequestErrored,
    InvalidBuffer,
    FailedParsing,
    InvalidJsonResponse,
    GameNotFound,
}

export async function downloadById(id: string): Promise<Run> {
    const response = await validatedFetch(
        `https://splits.io/api/v4/runs/${id}`,
        {
            headers: new Headers({
                Accept: "application/original-timer",
            }),
        },
        DownloadError.ApiRequestErrored,
    );

    const data = await mapPromiseErr(
        response.arrayBuffer(),
        DownloadError.InvalidBuffer,
    );

    return Run.parseArray(new Uint8Array(data), "", false).with((result) => {
        if (result.parsedSuccessfully()) {
            return result.unwrap();
        } else {
            throw DownloadError.FailedParsing;
        }
    });
}

export async function downloadPBByUsername(username: string, game: string): Promise<Run> {
    const pbsResponse = await validatedFetch(
        `https://splits.io/api/v4/runners/${username}/pbs`,
        {
            headers: new Headers({
                Accept: "application/original-timer",
            }),
        },
        DownloadError.ApiRequestErrored,
    );

    const { pbs }: GetRunnerPBsResponse = await mapPromiseErr(
        pbsResponse.json(),
        DownloadError.InvalidJsonResponse,
    );
    
    const pb = pbs.find((pb) => pb.game.shortname === game);

    if (pb === undefined) {
        throw DownloadError.GameNotFound;
    }

    return downloadById(pb.id);
}

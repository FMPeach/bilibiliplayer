/**
 *
 * @class ApiRecommendOrigin
 * @extends {Api}
 */

import URLS from "./urls";

// api-out -> module
interface IOutData {
    aid: number;
    click: number;
    cover: string;
    favorites: number;
    review: number;
    title: string;
    video_review: string;
}

export { IOutData as ApiRecommendOriginOutData };

export async function apiRecommendOrigin(aid: number) {
    const response = await fetch(URLS.RECOMMEND_ORIGIN + aid);
    const json = await response.json();
    if (json?.code === 0 && Array.isArray(json.data)) {
        return <IOutData[]>json.data.map((d: any) => ({
            ...d,
            cover: d.pic,
        }));
    }
    return <IOutData[]>[];
}
import {
    Chapter,
    ChapterDetails,
    ContentRating,
    SourceManga,
    PartialSourceManga,
    PagedResults,
    SearchRequest,
    Source,
    SourceInfo,
    SourceIntents,
    Tag,
    TagSection,
    Response,
} from '@paperback/types'

export const MangaDexInfo: SourceInfo = {
    version: '1.1.0',
    name: 'MangaDex',
    icon: 'icon.png',
    author: 'Cusa9227',
    authorWebsite: 'https://github.com/Cusa9227',
    description: 'MangaDex source using the official MangaDex API',
    contentRating: ContentRating.EVERYONE,
    websiteBaseURL: 'https://mangadex.org',
    intents: SourceIntents.MANGA_CHAPTERS,
}

export class MangaDex extends Source {

    apiUrl = 'https://api.mangadex.org'
    cdnUrl = 'https://uploads.mangadex.org'

    requestManager = App.createRequestManager({
        requestsPerSecond: 4,
        requestTimeout: 15000,
    })

    private async fetchJson(url: string): Promise<any> {

        const request = App.createRequest({
            url,
            method: 'GET',
            headers: {
                'user-agent':
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
                'accept': 'application/json',
                'referer': 'https://mangadex.org',
            },
        })

        const response: Response =
            await this.requestManager.schedule(request, 1)

        return JSON.parse(response.data as string)
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {

        const data = await this.fetchJson(
            `${this.apiUrl}/manga/${mangaId}?includes[]=author&includes[]=cover_art`
        )

        const attrs = data.data.attributes

        const title =
            attrs.title?.en ||
            Object.values(attrs.title ?? {})[0] ||
            ''

        const desc =
            attrs.description?.en ||
            Object.values(attrs.description ?? {})[0] ||
            ''

        const status =
            attrs.status === 'ongoing'
                ? 'Ongoing'
                : 'Completed'

        const author =
            data.data.relationships.find(
                (r: any) => r.type === 'author'
            )?.attributes?.name || ''

        const coverFile =
            data.data.relationships.find(
                (r: any) => r.type === 'cover_art'
            )?.attributes?.fileName || ''

        const image = coverFile
            ? `${this.cdnUrl}/covers/${mangaId}/${coverFile}.512.jpg`
            : ''

        const tags: Tag[] = (attrs.tags || []).map((tag: any) =>
            App.createTag({
                id: tag.id,
                label:
                    tag.attributes?.name?.en ||
                    tag.id,
            })
        )

        const tagSection: TagSection =
            App.createTagSection({
                id: 'genres',
                label: 'Genres',
                tags,
            })

        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title as string],
                image,
                author,
                desc,
                status,
                tags: [tagSection],
            }),
        })
    }

    async getChapters(mangaId: string): Promise<Chapter[]> {

        const data = await this.fetchJson(
            `${this.apiUrl}/manga/${mangaId}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=500`
        )

        return data.data.reverse().map((ch: any) => {

            const attrs = ch.attributes

            return App.createChapter({
                id: ch.id,

                name:
                    attrs.title ||
                    `Chapter ${attrs.chapter}`,

                chapNum:
                    parseFloat(attrs.chapter ?? '0'),

                langCode: 'gb',

                time:
                    attrs.publishAt
                        ? new Date(attrs.publishAt)
                        : undefined,
            })
        })
    }

    async getChapterDetails(
        mangaId: string,
        chapterId: string
    ): Promise<ChapterDetails> {

        const data = await this.fetchJson(
            `${this.apiUrl}/at-home/server/${chapterId}`
        )

        const baseUrl = data.baseUrl
        const hash = data.chapter.hash

        const pages = data.chapter.data.map(
            (file: string) =>
                `${baseUrl}/data/${hash}/${file}`
        )

        return App.createChapterDetails({
            id: chapterId,
            mangaId,
            pages,
        })
    }

    async getSearchResults(
        query: SearchRequest,
        _metadata: any
    ): Promise<PagedResults> {

        const title =
            encodeURIComponent(query.title ?? '')

        const data = await this.fetchJson(
            `${this.apiUrl}/manga?title=${title}&includes[]=cover_art&limit=20&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`
        )

        const tiles: PartialSourceManga[] =
            data.data.map((manga: any) => {

                const coverFile =
                    manga.relationships.find(
                        (r: any) => r.type === 'cover_art'
                    )?.attributes?.fileName || ''

                const image = coverFile
                    ? `${this.cdnUrl}/covers/${manga.id}/${coverFile}.512.jpg`
                    : ''

                const mangaTitle =
                    manga.attributes.title?.en ||
                    Object.values(
                        manga.attributes.title ?? {}
                    )[0] ||
                    ''

                return App.createPartialSourceManga({
                    mangaId: manga.id,
                    title: mangaTitle as string,
                    image,
                })
            })

        return App.createPagedResults({
            results: tiles,
        })
    }
}

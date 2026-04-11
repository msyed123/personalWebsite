import { defineEventHandler, getQuery } from 'h3'

function getTagContent(xml: string, tag: string): string {
  const esc = tag.replace(':', '\\:')
  // Try CDATA first
  const cdataRe = new RegExp(`<${esc}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${esc}>`, 'i')
  const cdataMatch = xml.match(cdataRe)
  if (cdataMatch) return cdataMatch[1].trim()
  // Plain content
  const re = new RegExp(`<${esc}[^>]*>([^<]*)<\\/${esc}>`, 'i')
  const match = xml.match(re)
  return match ? match[1].trim() : ''
}

function parseItems(xml: string): string[] {
  const items: string[] = []
  const re = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) items.push(m[1])
  return items
}

function extractImgSrc(html: string): string {
  const m = html.match(/<img[^>]+src="([^"]+)"/)
  return m ? m[1] : ''
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()
}

function extractReview(html: string): string {
  // Remove image paragraphs then strip tags
  const clean = html.replace(/<p>\s*<img[^>]+>\s*<\/p>/gi, '').replace(/<p>\s*<\/p>/gi, '')
  return stripTags(clean)
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const type = query.type as string

  const feedUrls: Record<string, string> = {
    letterboxd: 'https://letterboxd.com/darealmoonman/rss/',
    substack: 'https://noomam.substack.com/feed'
  }

  if (!feedUrls[type]) return { error: 'Unknown feed type' }

  try {
    const res = await fetch(feedUrls[type], {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PersonalSite/1.0)' }
    })
    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`)
    const xml = await res.text()

    const items = parseItems(xml)

    if (type === 'letterboxd') {
      return items.map((item) => {
        const description = getTagContent(item, 'description')
        const rating = getTagContent(item, 'letterboxd:memberRating') || getTagContent(item, 'letterboxd:rating')
        return {
          title: getTagContent(item, 'letterboxd:filmTitle') || getTagContent(item, 'title'),
          filmYear: getTagContent(item, 'letterboxd:filmYear'),
          rating: rating ? parseFloat(rating) : null,
          link: getTagContent(item, 'link') || (item.match(/<link>\s*([^<\s]+)\s*<\/link>/) || [])[1] || '',
          pubDate: getTagContent(item, 'pubDate'),
          watchedDate: getTagContent(item, 'letterboxd:watchedDate'),
          imageUrl: extractImgSrc(description),
          reviewText: extractReview(description)
        }
      })
    } else {
      // Substack
      return items.map((item) => {
        const description = getTagContent(item, 'description')
        const content = getTagContent(item, 'content:encoded') || description
        return {
          title: getTagContent(item, 'title'),
          link: getTagContent(item, 'link') || (item.match(/<link>\s*([^<\s]+)\s*<\/link>/) || [])[1] || '',
          pubDate: getTagContent(item, 'pubDate'),
          excerpt: stripTags(description).substring(0, 300),
          content
        }
      })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: 'Failed to fetch feed', detail: msg }
  }
})

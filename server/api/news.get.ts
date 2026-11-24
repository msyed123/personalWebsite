import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { defaultNewsTopic, isNewsTopic } from '../../utils/newsTopics.js'
import { createNewsReader } from '../utils/newsFeeds.js'

const getNews = createNewsReader()

export default defineEventHandler(async event => {
  const { topic = defaultNewsTopic } = getQuery(event)
  if (typeof topic !== 'string' || !isNewsTopic(topic)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown news topic' })
  }
  // Don't turn the site into a mirror or a public redistributable feed.
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex')
  return getNews(topic)
})

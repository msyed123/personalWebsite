export const newsTopics = Object.freeze([
  { id: 'headlines', label: 'Headlines' },
  { id: 'seattle', label: 'Seattle' },
  { id: 'space', label: 'Space' },
  { id: 'tech', label: 'Tech' }
])
export const defaultNewsTopic = 'headlines'
export const isNewsTopic = topic => newsTopics.some(({ id }) => id === topic)

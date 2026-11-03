import { getTopics } from './api.js'

// Placeholder until the screens exist: proves the data-access module reaches the API.
const app = document.getElementById('app')
getTopics()
  .then(({ topics }) => {
    app.innerHTML = '<h1>Topics</h1><ul></ul>'
    for (const t of topics) {
      const li = document.createElement('li')
      li.textContent = `${t.label} (${t.availability})`
      app.querySelector('ul').append(li)
    }
  })
  .catch((err) => {
    app.textContent = `Couldn't load topics: ${err.message}`
  })

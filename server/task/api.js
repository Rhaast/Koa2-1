const rp = require('request-promise-native')
const mongoose = require('mongoose')
const Movie = mongoose.model('Movie')
const Category = mongoose.model('Category')

async function fetchMovie(item) {
  // http://api.douban.com/v2/movie/subject/24773958
  const url = `http://api.douban.com/v2/movie/subject/${item.doubanId}`
  const res = await rp(url)
  let body

  try {
    body = JSON.parse(res)
  } catch (err) {
    console.error(err)
  }

  return body
}

~(async () => {
  let movies = await Movie.find({
    // 过滤或条件集合
    $or: [ // 只要满意其中之一都过滤拿出来
      { summary: { $exists: false } }, // summary不存在
      { summary: null },
      { summary: '' },
      { year: { $exists: false } },
      { title: '' }
    ]
  })

  // [movies[0]] 测试，只跑一次API请求，节省
  for (let i = 0; i < [movies[0]].length; i++) {
    let movie = movies[i]
    let movieData = await fetchMovie(movie)

    if (movieData) {
      let tags = movieData.tags || []

      movie.tags = movie.tags || []
      movie.title = movieData.alt_title || movieData.title || ''
      movie.originalTitle = movieData.original_title || ''
      movie.year = movieData.year || 2500
      movie.genres = movieData.genres || ''
      movie.countries = movieData.countries || ''
      movie.summary = movieData.summary || ''
      movie.subtype = movieData.subtype || ''

      if (movieData.attrs) {
        movie.movieTypes = movieData.attrs.movie_type || []

        for (let i = 0; i < movie.movieTypes.length; i++) {
          let item = movie.movieTypes[i]

          let cat = await Category.findOne({
            name: item
          })

          if (!cat) {
            cat = new Category({
              name: item,
              movies: [movie._id]
            })
          } else {
            if (cat.movies.indexOf(movie._id) === -1) {
              cat.movies.push(movie._id)
            }
          }

          await cat.save()

          if (!movie.category) {
            movie.category.push(cat._id)
          } else {
            if (movie.category.indexOf(cat._id) === -1) {
              movie.category.push(cat._id)
            }
          }
        }

        let dates = movieData.attrs.pubdate || []
        let pubdates = []

        // 获取电影上映日期
        dates.map(item => {
          if (item && item.split('(').length > 0) {
            let parts = item.split('(')
            let date = parts[0]
            let country = '未知'

            if (parts[1]) {
              country = parts[1].split(')')[0]
            }

            pubdates.push({
              date: new Date(date),
              country
            })
          }
        })
        movie.pubdates = pubdates
      }

      if (tags) {
        tags.forEach(tag => {
          movie.tags.push(tag.name)
        })
      }

      console.log(movie)
      await movie.save()
    }
  }
})()
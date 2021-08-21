const clc = require('cli-color');
const path = require('path');
const {
    MovieDb
} = require('moviedb-promise');
const {
    existsSync,
    readFileSync
} = require('fs');
const {
    getID
} = require('../../../cache/lib/cacheID');
const {
    downloadImage
} = require('../../../bin/downloadImage');
const {
    createImage
} = require('../../images/createImage');
const {
    readJSON,
    saveJSON
} = require('../../../bin/readWrite');
const config = readJSON(path.join(__dirname, '../', '../', '../', 'config', 'config.json'), true);
const moviedb = new MovieDb(config.movieDB);


async function plexMovie(res, req, tautulli, next) {
    // format plex data
    var data = {
        "id": await getID({
            "name": tautulli.media.playback.name,
            "type": 'movie'
        }),
        "name": tautulli.media.playback.name,
        "tagline": tautulli.media.playback.tagline,
        "tmdbID": tautulli.media.tmdbID != '' ? tautulli.media.tmdbID : '000000',
        "URL": { 
            "plex": tautulli.media.playback.plexURL,
            "tmdb": tautulli.media.tmdbID != '' ? `https://www.themoviedb.org/movie/${tautulli.media.tmdbID}` : '',
        },
        "images": {
            "poster": tautulli.media.playback.posterURL,
            "background": ''
        }
    }

    console.log(clc.blue('[Info]'), `New episode card request (${data.name} (${data.id}))`);

    // check if image exists
    if (!existsSync(path.join(__dirname, '../', '../', '../', 'static', 'images', `image-${data.id}.png`))) {
        // download tautulli poster
        data.images.poster = await downloadImage(data.images.poster, 'Tautulli');

        // see if we can use tmdb
        if (data.tmdbID != '000000') {
            var tmdbSuccess = true;

            // get show and episode info from tmdb
            var tmdb = {
                "movie": {}
            }
            await moviedb.movieInfo({
                id: data.tmdbID
            }).then((tmdbData) => {
                tmdb.movie = tmdbData;
            }).catch((err) => {
                tmdbSuccess = false;
                console.log(clc.red('[Fail]'), `Failed to grab TMDB info for "${data.name}"`);
                console.log(err);
            });

            // only continue if getting data from tmdb was a success
            if (tmdbSuccess) {
                // download tmdb poster and background
                if (tmdb.movie.poster_path != null) {
                    data.images.poster = await downloadImage(`https://image.tmdb.org/t/p/original${tmdb.movie.poster_path}`, "TMDB");
                }
                if (tmdb.movie.backdrop_path != null) {
                    data.images.background = await downloadImage(`https://image.tmdb.org/t/p/original${tmdb.movie.backdrop_path}`, "TMDB");
                }

                // use TMDBs overview
                if (tmdb.movie.overview != '') {
                    data.tagline = tmdb.movie.overview;
                }
            }
        }

        // create image
        await createImage(data);

        res.send({
            success: true,
            "id": data.id,
            "imageURL": `${req.get('host')}/static/images/image-${data.id}.png`
        });
    } else {
        console.log(clc.blue('[Info]'), `Image already exists (${data.name} (${data.id}))`);

        // load image buffer
        var image = readFileSync(path.join(__dirname, '../', '../', '../', 'static', 'images', `image-${data.id}.png`));

        res.send({
            success: true,
            "id": data.id,
            "imageURL": `${req.get('host')}/static/images/image-${data.id}.png`
        });
    }
}

module.exports = {
    plexMovie
}
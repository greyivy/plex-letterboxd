import PlexAPI from "plex-api"
import querystring from 'node:querystring'
import fetch from "node-fetch"
import * as cheerio from 'cheerio'
import urlJoin from 'url-join'
import fs from 'fs'
import commandLineArgs from 'command-line-args'

const optionDefinitions = [
	{ name: 'ip', type: String },
	{ name: 'listPath', type: String, multiple: false, defaultOption: true },
]
const options = commandLineArgs(optionDefinitions)

const client = new PlexAPI(options.ip);

// TODO ratings

const lists = fs.readFileSync(options.listPath, 'utf8').split('\n')

async function getListInfo(url) {
	let html = await fetch(url.includes('/detail') ? url : urlJoin(url, 'detail'))
	let $ = cheerio.load(await html.text())

	const title = $('.list-title-intro h1').text().trim()
	const summary = $('.list-title-intro .body-text').text().trim()

	const backdropUrl = $('#backdrop')?.data('backdrop2x')

	const films = []
	while (true) {
		$('.film-detail-content').each((i, el) => {
			const title = $(el).find('h2 > a').text().trim()
			const year = parseInt($(el).find('h2 .metadata').text().trim())
			films.push({
				title, year
			})
		})

		const urlNextPage = $('.paginate-nextprev .next')?.attr('href')
		if (!urlNextPage) break

		// Request next page
		html = await fetch(new URL(urlNextPage, 'https://letterboxd.com'))
		$ = cheerio.load(await html.text())
	}

	return {
		url,
		title,
		summary,
		backdropUrl,
		films
	}
}

async function processList(url) {
	console.log(`Processing list "${url}"`)

	const list = await getListInfo(url)

	const { machineIdentifier } = (await client.query("/")).MediaContainer
	const { Metadata: plexFilms } = (await client.query("/library/sections/1/all")).MediaContainer

	const filmKeys = []
	for (const listFilm of list.films) {
		const foundFilm = plexFilms.find(plexFilm => {
			const titleMatches = listFilm.title.localeCompare(plexFilm.title, undefined, { sensitivity: 'accent' }) === 0
			const yearMatches = listFilm.year >= plexFilm.year - 1 && listFilm.year <= plexFilm.year + 1

			return titleMatches && yearMatches
		})

		if (foundFilm) {
			console.info(`✅ ${listFilm.title} (${listFilm.year})`)
			filmKeys.push(foundFilm.key)
		} else {
			console.warn(`❌ ${listFilm.title} (${listFilm.year})`)
		}
	}

	const allCollections = (await client.query(`/library/sections/1/collections`)).MediaContainer.Metadata
	let collection = allCollections?.find(collection => collection.summary.includes(list.url))

	if (!collection) {
		console.log(`Creating collection "${list.title}"`)

		// Create collection
		collection = (await client.postQuery(`/library/collections?${querystring.stringify({
			type: 1,
			title: list.title,
			smart: 0,
			sectionId: 1,
		})}`)).MediaContainer.Metadata[0]
	}

	const { ratingKey } = collection

	// Update summary
	await client.putQuery(`/library/sections/1/all?${querystring.stringify({
		type: 18,
		id: ratingKey,
		'summary.value': `${list.summary}\n\n${list.url}`,
		'summary.locked': 1,
		'title.value': list.title,
		'title.locked': 1
	})}`)

	// Set sorting to "Custom"
	await client.putQuery(`/library/metadata/${ratingKey}/prefs?${querystring.stringify({
		collectionSort: 2 // Custom
	})}`)

	// Update backdrop
	if (list.backdropUrl) {
		await client.postQuery(`/library/collections/${ratingKey}/arts?${querystring.stringify({
			url: list.backdropUrl
		})}`)
	}

	// Add films
	console.log(`Adding ${filmKeys.length} films`)
	for (const key of filmKeys) {
		await client.putQuery(`/library/collections/${ratingKey}/items?${querystring.stringify({
			uri: `server://${machineIdentifier}/com.plexapp.plugins.library${key}`
		})}`)
	}

	// TODO sorting
}

async function run() {
	let exitCode = 0

	for (const list of lists) {
		if (!list.trim()) continue

		try {
			await processList(list)
		} catch (e) {
			console.error(`Failed processing list "${list}": ${e.message}`)
			console.error(e)
			exitCode = 1
		}
	}

	process.exit(exitCode)
}

run()

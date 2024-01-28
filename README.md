# plex-letterboxd

Creates Plex collections for Letterboxd lists.

## Installation

1. `git clone https://github.com/greyivy/plex-letterboxd.git`
2. `cd plex-letterboxd`
3. `npm install`

## Usage

`node ./index.js --ip {PLEX_IP} --username {OPTIONAL_USERNAME} --token {OPTIONAL_TOKEN} {LIST_TXT_PATH}`

Where `{LIST_TXT_PATH}` is the path to a file with one Letterboxd list URL per line. For example:

```
https://letterboxd.com/dave/list/official-top-250-narrative-feature-films/
https://letterboxd.com/kun/list/befriending-the-lyrical-loneliness/
https://letterboxd.com/dselwyns/list/sarahs-great-big-somehow-controversial-lesbian/
```

The script can be run manually or at regular intervals as a cron task.

## Screenshot

![image](https://user-images.githubusercontent.com/5335625/204074955-5330e41a-90b2-4971-9c7c-f68739e6ee2a.png)

## Roadmap

- [ ] Sync ratings
- [ ] Sync list order

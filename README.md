## Introduction
A lightweight Looking Glass built with [Node.js](https://nodejs.org/) and [Bootstrap 5.3](https://getbootstrap.com/docs/5.3/getting-started/introduction/), this project draws heavy inspiration from [Hybula Looking Glass](https://github.com/hybula/lookingglass), but has been reimagined and completely rewritten in Node.js. It utilizes WebSockets for real-time communication. Check out the [live demo](https://lg-de-fra.erpa.cc/), which features the Cosmo theme from Bootswatch.

![bootstrap-light](https://imgur.com/voa3YJe.png)
![bootstrap-dark](https://imgur.com/ROOF5nq.png)

## Requirements
- Linux
- Node.js
- `ping`, `mtr`, `traceroute`

## Installation
Clone the repository and navigate into the directory. Rename `config.dist.json` to `config.json`. You can customize the stylesheet value in `config.json` to use a [Bootswatch theme](https://bootswatch.com/) (e.g., `https://bootswatch.com/5/flatly/bootstrap.min.css`) and set the `themeMode` to either `light` or `dark`. Finally, run the application through a reverse proxy to access it.

## License
This project is licensed under the [MIT License](LICENSE).

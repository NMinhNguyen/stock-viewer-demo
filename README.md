# stock-viewer-demo

Created with CodeSandbox

## Configuration

### Create an account on Finnhub

First, [create an account on Finnhub](https://finnhub.io/).

After creating an account, make note of your _API key_ (you can also use your sandbox API key).

### Set up environment variables

Copy the `env.local.example` file in this directory to `.env.local` (which will be ignored by Git):

```bash
cp .env.local.example .env.local
```

Set the `REACT_APP_FINNHUB_API_KEY` variable in `.env.local` to the Finnhub _API key_.

### Install and run:

```bash
npm install
npm start
# or
yarn
yarn start
```

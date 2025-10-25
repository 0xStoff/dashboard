const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const webpack = require('webpack'); // Import Webpack

module.exports = {
    entry: './src/index.tsx',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bundle.js',
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx'], // Add '.tsx' and '.ts' as resolvable extensions.
        fallback: {
            // Polyfills for node modules required by CosmJS
            "crypto": require.resolve("crypto-browserify"),
            "stream": require.resolve("stream-browserify"),
            "assert": require.resolve("assert/"),
            "http": require.resolve("stream-http"),
            "https": require.resolve("https-browserify"),
            "os": require.resolve("os-browserify/browser"),
            "vm": false,
            "url": require.resolve("url/"),
            "buffer": require.resolve("buffer/"), // Add Buffer polyfill
        },
    },
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/, // Match both .ts and .tsx files
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
                    },
                },
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './public/index.html', // Path to your HTML template
        }),
        new Dotenv({
            systemvars: true,
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'], // Provide Buffer globally
        }),
    ],
    devServer: {
        allowedHosts: "all",
        host: "0.0.0.0",
        port: 8080,
        proxy: {
            "/binance": {
                target: "https://api.binance.com",
                changeOrigin: true,
                secure: true,
                pathRewrite: { "^/binance": "" },
            },
            '/kraken': {
                target: 'https://api.kraken.com', // Kraken API base URL
                pathRewrite: { '^/kraken': '' }, // Remove `/kraken` from the request path
                changeOrigin: true,
                secure: true,
            },
            '/cosmos': {
                target: 'https://cosmos-grpc.publicnode.com:443', // Cosmos API base URL
                changeOrigin: true,
                secure: false,
            },
            '/api': {
                target: 'http://stoffpi.local:3000',
                changeOrigin: true,
                secure: false,
            },
        },
    },
};
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const webpack = require('webpack'); // Import Webpack

module.exports = (_, argv = {}) => {
    const isProduction = argv.mode === 'production';

    return {
    entry: './src/index.tsx',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: isProduction ? '[name].[contenthash:8].js' : '[name].js',
        chunkFilename: isProduction ? '[name].[contenthash:8].chunk.js' : '[name].chunk.js',
        clean: true,
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
    optimization: {
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                react: {
                    test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
                    name: 'react-vendor',
                    priority: 30,
                },
                mui: {
                    test: /[\\/]node_modules[\\/](@mui|@emotion)[\\/]/,
                    name: 'mui-vendor',
                    priority: 20,
                },
                charts: {
                    test: /[\\/]node_modules[\\/](@mui[\\/]x-charts|recharts|d3-.*)[\\/]/,
                    name: 'charts-vendor',
                    priority: 20,
                },
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    priority: 10,
                },
            },
        },
        runtimeChunk: 'single',
    },
    performance: isProduction ? {
        hints: 'warning',
        maxAssetSize: 1500000,
        maxEntrypointSize: 2000000,
    } : false,
    devServer: {
        allowedHosts: "all",
        host: "0.0.0.0",
        port: 8080,
        client: {
            overlay: {errors: true, warnings: false},
        },
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
                target: 'http://backend:3000',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    };
};

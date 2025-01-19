import React, { useEffect, useState } from "react";
import Moralis from "moralis";
import {
    Container,
    Grid,
    Card,
    CardMedia,
    CardContent,
    Typography,
    CircularProgress,
    Avatar,
    Box,
} from "@mui/material";
import BrokenImageIcon from "@mui/icons-material/BrokenImage";

Moralis.start({ apiKey: process.env.REACT_APP_MORALIS_API_KEY });

const resolveIPFS = (url) => {
    if (url?.startsWith("ipfs://")) {
        return url.replace("ipfs://", "https://ipfs.io/ipfs/");
    }
    return null; // Return null if no valid URL is provided
};

const fetchNFTPortfolio = async (walletAddress, chain = "0x1") => {
    try {
        const response = await Moralis.EvmApi.nft.getWalletNFTs({
            address: walletAddress,
            chain,
        });

        return response.result.map((nft) => ({
            tokenId: nft.tokenId,
            name: nft.name || nft.metadata?.name || "Unnamed NFT",
            image: resolveIPFS(nft.metadata?.image),
            price: nft.price || "No price available",
            contractType: nft.contractType,
            chain,
        }));
    } catch (error) {
        console.error("Error fetching NFTs:", error.message);
        return [];
    }
};

const NFTCard = ({ nft }) => {
    const [imageSrc, setImageSrc] = useState(nft.image);
    const [retryCount, setRetryCount] = useState(0);
    const [imageError, setImageError] = useState(false);

    const handleImageError = () => {
        if (retryCount < 3 && nft.image) {
            setRetryCount(retryCount + 1);
            setImageSrc(`${nft.image}?retry=${retryCount}`);
        } else {
            setImageError(true);
        }
    };

    return (
        <Card>
            {imageError ? (
                <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    height="200px"
                    bgcolor="#f5f5f5"
                >
                    <Avatar sx={{ width: 100, height: 100, bgcolor: "grey.300" }}>
                        <BrokenImageIcon />
                    </Avatar>
                </Box>
            ) : (
                <CardMedia
                    component="img"
                    height="200"
                    image={imageSrc}
                    alt={nft.name}
                    onError={handleImageError}
                />
            )}
            <CardContent>
                <Typography variant="h6">{nft.name}</Typography>
                <Typography variant="body2">Token ID: {nft.tokenId}</Typography>
                <Typography variant="body2">Price: {nft.price}</Typography>
                <Typography variant="body2">Contract: {nft.contractType}</Typography>
            </CardContent>
        </Card>
    );
};

const NFTPortfolio = ({ walletAddress }) => {
    const [nfts, setNfts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNFTs = async () => {
            setLoading(true);
            const nftData = await fetchNFTPortfolio(walletAddress);
            console.log(nftData)
            setNfts(nftData);
            setLoading(false);
        };

        fetchNFTs();
    }, [walletAddress]);

    if (loading) {
        return (
            <Container>
                <Typography variant="h5" gutterBottom>
                    Loading NFTs...
                </Typography>
                <CircularProgress />
            </Container>
        );
    }

    return (
        <Container>
            <Typography variant="h4" gutterBottom>
                NFT Portfolio
            </Typography>
            <Grid container spacing={3}>
                {nfts.map((nft, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                        <NFTCard nft={nft} />
                    </Grid>
                ))}
            </Grid>
        </Container>
    );
};

export default NFTPortfolio;
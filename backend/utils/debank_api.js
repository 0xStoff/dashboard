import axios from 'axios';

const fetchDebankData = async (endpoint, params = {}) => {
    try {
        const response = await axios.get(`https://pro-openapi.debank.com/v1${endpoint}`, {
            headers: {
                Accept: 'application/json', AccessKey: process.env.RABBY_ACCESS_KEY
            },
            params
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching DeBank data:', error);
        throw error;
    }
};

export default fetchDebankData;
import axios from "axios";

const API_BASE_URL = "http://localhost:3000/api";

export const saveNetWorthToDB = async (totalNetWorth, historyData) => {
  try {
    const payload = { date: new Date().toISOString(), totalNetWorth, historyData };
    await axios.post(`${API_BASE_URL}/net-worth`, payload);
  } catch (error) {
    console.error("Error saving net worth to DB:", error);
  }
};
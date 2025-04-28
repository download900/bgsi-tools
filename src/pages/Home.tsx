import React, { useEffect, useRef, useState } from "react";
import {
  Container,
  Box,
  Button,
  Checkbox,
  Typography,
  Paper,
} from "@mui/material";
import { Link } from "react-router-dom";

export function Home() {

    return (
        <Container maxWidth="md" sx={{ mt: 2 }}>
        <Paper elevation={3} sx={{ padding: 2 }}>
            <Link to="/bgsi-tools/completion" style={{ textDecoration: "none", color: "inherit" }}>
                <Button size="large" variant="outlined" color="primary" fullWidth sx={{ fontSize:30, mb: 2 }}>
                    🏆 Completion Tracker
                </Button>
            </Link>
            <Link to="/bgsi-tools/odds" style={{ textDecoration: "none", color: "inherit" }}>
                <Button size="large" variant="outlined" color="primary" fullWidth sx={{ fontSize:30, mb: 2 }}>
                    🎲 Odds Calculator
                </Button>
            </Link>
        </Paper>
        </Container>
    );
}
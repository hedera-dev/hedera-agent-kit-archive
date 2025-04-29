import { describe, expect, it, beforeAll } from "vitest";
import { NetworkClientWrapper } from "../utils/testnetClient";
import * as dotenv from "dotenv";
import BigNumber from "bignumber.js";
import { HederaNetworkType } from "../../types";
import {getHTSDecimals, toBaseUnit, toDisplayUnit} from "../../utils/hts-format-utils";
import { wait } from "../utils/utils";


describe("Token Unit Conversion Functions", () => {
    let networkClientWrapper: NetworkClientWrapper;
    let tokenDecimals0: string; // Token with 0 decimals
    let tokenDecimals2: string; // Token with 2 decimals
    let tokenDecimals8: string; // Token with 8 decimals
    const networkType: HederaNetworkType = "testnet";

    // Configure BigNumber to show all digits
    BigNumber.config({ DECIMAL_PLACES: 18, ROUNDING_MODE: BigNumber.ROUND_DOWN });

    beforeAll(async () => {
        dotenv.config();

        try {
            // Create network client for interacting with Hedera
            networkClientWrapper = new NetworkClientWrapper(
                process.env.HEDERA_ACCOUNT_ID!,
                process.env.HEDERA_PRIVATE_KEY!,
                process.env.HEDERA_KEY_TYPE!,
                "testnet"
            );

            // Create three tokens with different decimal places
            tokenDecimals0 = await networkClientWrapper.createFT({
                name: "ZeroDecimalToken",
                symbol: "ZDT",
                initialSupply: 1000,
                decimals: 0,
            });

            tokenDecimals2 = await networkClientWrapper.createFT({
                name: "TwoDecimalToken",
                symbol: "TDT",
                initialSupply: 1000,
                decimals: 2,
            });

            tokenDecimals8 = await networkClientWrapper.createFT({
                name: "EightDecimalToken",
                symbol: "EDT",
                initialSupply: 1000,
                decimals: 8,
            });

            // Wait for token creation to be processed
            await wait(5000);

            console.log("Created test tokens:", {
                tokenDecimals0,
                tokenDecimals2,
                tokenDecimals8
            });

        } catch (error) {
            console.error("Error in setup:", error);
            throw error;
        }
    });

    describe("getHTSDecimals", () => {
        it("should correctly fetch token decimals", async () => {
            // Test token with 0 decimals
            const decimals0 = await getHTSDecimals(tokenDecimals0, networkType);
            expect(decimals0).toEqual("0");

            // Test token with 2 decimals
            const decimals2 = await getHTSDecimals(tokenDecimals2, networkType);
            expect(decimals2).toEqual("2");

            // Test token with 8 decimals
            const decimals8 = await getHTSDecimals(tokenDecimals8, networkType);
            expect(decimals8).toEqual("8");
        });

        it("should handle non-existent tokens gracefully", async () => {
            try {
                await getHTSDecimals("0.0.999999999", networkType);
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeDefined();
            }
        });
    });

    describe("toDisplayUnit", () => {
        it("should convert base units to display units for 0 decimal token", async () => {
            // For 0 decimals, the base and display values should be the same
            const baseValue = new BigNumber(100);
            const displayValue = await toDisplayUnit(tokenDecimals0, baseValue, networkType);
            expect(displayValue.toString()).toEqual("100");
        });

        it("should convert base units to display units for 2 decimal token", async () => {
            // For 2 decimals, 100 base units = 1.00 display units
            const baseValue = new BigNumber(100);
            const displayValue = await toDisplayUnit(tokenDecimals2, baseValue, networkType);
            expect(displayValue.toString()).toEqual("1");

            // Test another value
            const baseValue2 = new BigNumber(12345);
            const displayValue2 = await toDisplayUnit(tokenDecimals2, baseValue2, networkType);
            expect(displayValue2.toString()).toEqual("123.45");
        });

        it("should convert base units to display units for 8 decimal token", async () => {
            // For 8 decimals, 100000000 base units = 1.00000000 display units
            const baseValue = new BigNumber(100000000);
            const displayValue = await toDisplayUnit(tokenDecimals8, baseValue, networkType);
            expect(displayValue.toString()).toEqual("1");

            // Test fractional amounts
            const baseValue2 = new BigNumber(123456789);
            const displayValue2 = await toDisplayUnit(tokenDecimals8, baseValue2, networkType);
            expect(displayValue2.toString()).toEqual("1.23456789");
        });

        it("should handle number inputs correctly", async () => {
            // Test with regular number instead of BigNumber
            const baseValue = 12345;
            const displayValue = await toDisplayUnit(tokenDecimals2, baseValue, networkType);
            expect(displayValue.toString()).toEqual("123.45");
        });

        it("should return 0 for invalid tokens", async () => {
            const displayValue = await toDisplayUnit("0.0.999999999", 100, networkType);
            expect(displayValue.toString()).toEqual("0");
        });
    });

    describe("toBaseUnit", () => {
        it("should convert display units to base units for 0 decimal token", async () => {
            // For 0 decimals, display and base should be the same
            const displayValue = new BigNumber(100);
            const baseValue = await toBaseUnit(tokenDecimals0, displayValue, networkType);
            expect(baseValue.toString()).toEqual("100");
        });

        it("should convert display units to base units for 2 decimal token", async () => {
            // For 2 decimals, 1.00 display units = 100 base units
            const displayValue = new BigNumber(1);
            const baseValue = await toBaseUnit(tokenDecimals2, displayValue, networkType);
            expect(baseValue.toString()).toEqual("100");

            // Test fractional amounts
            const displayValue2 = new BigNumber(123.45);
            const baseValue2 = await toBaseUnit(tokenDecimals2, displayValue2, networkType);
            expect(baseValue2.toString()).toEqual("12345");
        });

        it("should convert display units to base units for 8 decimal token", async () => {
            // For 8 decimals, 1.00000000 display units = 100000000 base units
            const displayValue = new BigNumber(1);
            const baseValue = await toBaseUnit(tokenDecimals8, displayValue, networkType);
            expect(baseValue.toString()).toEqual("100000000");

            // Test with many decimal places
            const displayValue2 = new BigNumber(1.23456789);
            const baseValue2 = await toBaseUnit(tokenDecimals8, displayValue2, networkType);
            expect(baseValue2.toString()).toEqual("123456789");
        });

        it("should handle number inputs correctly", async () => {
            // Test with regular number instead of BigNumber
            const displayValue = 123.45;
            const baseValue = await toBaseUnit(tokenDecimals2, displayValue, networkType);
            expect(baseValue.toString()).toEqual("12345");
        });

        it("should handle very small fractional values", async () => {
            // Very small fraction that tests precision
            const displayValue = new BigNumber("0.00000001");
            const baseValue = await toBaseUnit(tokenDecimals8, displayValue, networkType);
            expect(baseValue.toString()).toEqual("1");
        });

        it("should return 0 for invalid tokens", async () => {
            const baseValue = await toBaseUnit("0.0.999999999", 100, networkType);
            expect(baseValue.toString()).toEqual("0");
        });
    });

    describe("Conversion roundtrip", () => {
        it("should return the original value after roundtrip conversion", async () => {
            const originalDisplay = new BigNumber(123.456789);

            const baseValue = await toBaseUnit(tokenDecimals8, originalDisplay, networkType);

            const roundtripDisplay = await toDisplayUnit(tokenDecimals8, baseValue, networkType);

            expect(roundtripDisplay.toString()).toEqual("123.456789");
        });

        it("should handle multiple roundtrips consistently", async () => {
            // Start with base value
            const originalBase = new BigNumber(12345678);

            // Base → Display → Base
            const displayValue = await toDisplayUnit(tokenDecimals2, originalBase, networkType);
            const roundtripBase = await toBaseUnit(tokenDecimals2, displayValue, networkType);

            expect(roundtripBase.toString()).toEqual(originalBase.toString());
        });
    });
});
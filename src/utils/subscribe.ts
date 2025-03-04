import fs from "fs";
import chalk from "chalk";
import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";
import dotenv from "dotenv";
dotenv.config();

interface TokenData {
  signer: string;
  baseAddress: string;
  baseDecimals: number;
  baseLpAmount: number;
  quoteAddress: string;
  quoteDecimals: number;
  quoteLpAmount: number;
}

export async function monitorNewTokens(
  connection: Connection,
  rayFee: PublicKey,
  onNewTokenDetected: (tokenAddress0: string, tokenAddress1: string) => void
): Promise<void> {
  console.log(chalk.green("Monitoring new Solana tokens..."));

  try {
    connection.onLogs(
      rayFee,
      async ({ logs, err, signature }) => {
        try {
          if (err) {
            console.error("Connection contains error:", err);
            return;
          }

          console.log(
            chalk.bgGreen(`\nFound new token signature: ${signature}`)
          );

          const tokenData: TokenData = {
            signer: "",
            baseAddress: "",
            baseDecimals: 0,
            baseLpAmount: 0,
            quoteAddress: "",
            quoteDecimals: 0,
            quoteLpAmount: 0,
          };

          const parsedTransaction: ParsedTransactionWithMeta | null =
            await connection.getParsedTransaction(signature, {
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed",
            });

          if (parsedTransaction?.meta?.err === null) {
            console.log("Successfully parsed transaction");

            tokenData.signer =
              parsedTransaction.transaction.message.accountKeys[0].pubkey.toString();
            console.log("Creator:", tokenData.signer);

            const postTokenBalances = parsedTransaction.meta.postTokenBalances;
            const POOL_OWNER = "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL";
            const WSOL_MINT = "So11111111111111111111111111111111111111112";

            console.log("postTokenBalances", postTokenBalances);

            const baseInfo = postTokenBalances?.find(
              (balance) =>
                balance.owner === POOL_OWNER && balance.mint !== WSOL_MINT
            );

            if (baseInfo) {
              tokenData.baseAddress = baseInfo.mint;
              tokenData.baseDecimals = baseInfo.uiTokenAmount.decimals;
              tokenData.baseLpAmount = baseInfo.uiTokenAmount.uiAmount ?? 0;
            }

            const quoteInfo = postTokenBalances?.find(
              (balance) =>
                balance.owner === POOL_OWNER && balance.mint === WSOL_MINT
            );

            if (quoteInfo) {
              tokenData.quoteAddress = quoteInfo.mint;
              tokenData.quoteDecimals = quoteInfo.uiTokenAmount.decimals;
              tokenData.quoteLpAmount = quoteInfo.uiTokenAmount.uiAmount ?? 0;
            }
          }

          console.log(chalk.red("Token Address:", tokenData.baseAddress));
          const newTokenData = {
            lpSignature: signature,
            creator: tokenData.signer,
            timestamp: new Date().toISOString(),
            baseInfo: {
              baseAddress: tokenData.baseAddress,
              baseDecimals: tokenData.baseDecimals,
              baseLpAmount: tokenData.baseLpAmount,
            },
          };

          onNewTokenDetected(tokenData.quoteAddress, tokenData.baseAddress);
        } catch (error) {
          const errorMessage = `Error occurred in new Solana token log callback: ${JSON.stringify(
            error,
            null,
            2
          )}`;
          console.log(chalk.red(errorMessage));

          fs.appendFile("errorNewLpsLogs.txt", `${errorMessage}\n`, (err) => {
            if (err) console.log("Error writing error logs:", err);
          });
        }
      },
      "confirmed"
    );
  } catch (error) {
    const errorMessage = `Error occurred in new Solana LP monitor: ${JSON.stringify(
      error,
      null,
      2
    )}`;
    console.log(chalk.red(errorMessage));
  }
}

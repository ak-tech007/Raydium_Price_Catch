import { Connection, PublicKey } from "@solana/web3.js";
import { monitorNewTokens } from "./utils/subscribe";
import dotenv from "dotenv";
dotenv.config();

const RPC_ENDPOINT = process.env.RPC_URL || "";

const connection = new Connection(RPC_ENDPOINT, "confirmed");
async function main() {
  const programId = new PublicKey(
    "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"
  );
  const ammConfig = await connection.getProgramAccounts(programId, {
    filters: [{ dataSize: 236 }], // Data size of AmmConfig struct
  });
  if (ammConfig.length === 0) {
    throw new Error("No ammConfig account found.");
  }
  const ammConfigAccount = ammConfig[0]; // Get the first account
  const rayFee = new PublicKey("DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8");

  monitorNewTokens(connection, rayFee, async (tokenAddress0, tokenAddress1) => {
    const [poolState] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool", "utf-8"),
        ammConfigAccount.pubkey.toBuffer(),
        new PublicKey(tokenAddress0).toBuffer(),
        new PublicKey(tokenAddress1).toBuffer(),
      ],
      programId
    );
    const [token0Vault] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool_vault"),
        poolState.toBuffer(),
        new PublicKey(tokenAddress0).toBuffer(),
      ],
      programId
    );
    const [token1Vault] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool_vault"),
        poolState.toBuffer(),
        new PublicKey(tokenAddress1).toBuffer(),
      ],
      programId
    );
    console.log("PoolState:", poolState.toBase58());

    const poolInfo = await connection.getAccountInfo(poolState);
    if (!poolInfo) {
      console.log(`❌ Pool ${poolState.toBase58()} does not exist on-chain.`);
    } else {
      console.log(`✅ Pool ${poolState.toBase58()} exists on-chain.`);
    }

    console.log("Derived token1Vault:", token1Vault.toString());
    console.log("tokenMint:", tokenAddress1);

    // Step 2: Check if the token vault account exists
    const tokenVaultInfo = await connection.getAccountInfo(token1Vault);
    if (!tokenVaultInfo) {
      console.log("Token vault account does not exist.");
      return;
    }
    console.log("TokenVaultInfo:", tokenVaultInfo);

    // Step 3: Fetch token balance directly
    try {
      const tokenAccount0 = await connection.getTokenAccountBalance(
        token0Vault
      );
      const tokenAccount1 = await connection.getTokenAccountBalance(
        token1Vault
      );
      console.log("Token 0 Balance in Vault:", tokenAccount0.value.uiAmount);
      console.log("Token 1 Balance in Vault:", tokenAccount1.value.uiAmount);
      const price =
        tokenAccount0.value.uiAmount && tokenAccount1.value.uiAmount
          ? tokenAccount0.value.uiAmount / tokenAccount1.value.uiAmount
          : null;
      if (price !== null) {
        console.log("Price:", price);
      } else {
        console.log("Unable to calculate price due to null values");
      }
    } catch (error) {
      console.error("Error fetching token account balance:", error);
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

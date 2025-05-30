import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorEscrow } from "../target/types/anchor_escrow";
import { TOKEN_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";
import { randomBytes } from "crypto";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_2022_PROGRAM_ID,
  // TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
} from "@solana/spl-token";
import { BN } from "bn.js";

describe("anchor-escrow", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const provider = anchor.getProvider();
  const connection = provider.connection;

  const program = anchor.workspace.AnchorEscrow as Program<AnchorEscrow>;

  const tokenProgram = TOKEN_PROGRAM_ID;

  const confirm = async (signature: string): Promise<string> => {
    const block = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      ...block,
    });
    return signature;
  };

  const log = async (signature: string): Promise<string> => {
    console.log(
      `\nYour transaction signature: https://explorer.solana.com/transaction/${signature}?cluster=custom&customUrl=${connection.rpcEndpoint}`
    );
    return signature;
  };

  const seed = new anchor.BN(randomBytes(8));

  const [taker, mintB] = Array.from({ length: 2 }, () =>
    Keypair.generate()
  );

    const [makerAtaB, takerAtaB] = [ provider, taker]
    .map((a) =>
      [mintB].map((m) =>
        getAssociatedTokenAddressSync(m.publicKey, a.publicKey, false, tokenProgram)
      )
    )
    .flat();

    const escrow = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), provider.publicKey.toBuffer(), seed.toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];


    const vaultState = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("state"), provider.publicKey.toBytes()], program.programId)[0];
    const vault = anchor.web3.PublicKey.findProgramAddressSync([Buffer.from("vault"), vaultState.toBytes()], program.programId)[0];

    

    console.log("Vault State:", vaultState);
    console.log("Vault:", vault);

    const accounts = {
      maker: provider.publicKey,
      taker: taker.publicKey,
      mintB: mintB.publicKey,
      makerAtaB,
      takerAtaB,
      escrow,
      vault,
      vaultState,
      tokenProgram,
    }

    it("Initialize mint B only", async () => {
      const lamports = await getMinimumBalanceForRentExemptMint(connection);
      const tx = new Transaction();
      
      tx.instructions = [
        SystemProgram.createAccount({
          fromPubkey: provider.publicKey,
          newAccountPubkey: mintB.publicKey,
          lamports,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMint2Instruction(
          mintB.publicKey,
          6, // decimals
          taker.publicKey, // authority
          null, // freeze authority
          TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          provider.publicKey,
          takerAtaB,
          taker.publicKey,
          mintB.publicKey,
          TOKEN_PROGRAM_ID
        ),
        createMintToInstruction(
          mintB.publicKey,
          takerAtaB,
          taker.publicKey,
          1e9, // 1B tokens
          [],
          TOKEN_PROGRAM_ID
        )
      ];

      // const fromAirDropSignature = await connection.requestAirdrop(
      //   new PublicKey(provider.publicKey),
      //   2 * LAMPORTS_PER_SOL
      // );

    // console.log(fromAirDropSignature);
    
    
      await provider.sendAndConfirm(tx, [mintB, taker]).then(log);
    });

    it("Make", async () => {
      await program.methods
        .make(seed, new BN(1e9), new BN(1e9))
        .accounts({ ...accounts })
        .rpc()
        .then(confirm)
        .then(log);
    });

    it("Refund", async () => {

      await program.methods
        .refund()
        .accounts({ ...accounts })
        .rpc()
        .then(confirm)
        .then(log);
    });
  });

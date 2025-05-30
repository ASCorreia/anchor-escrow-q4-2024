use anchor_lang::prelude::*;

mod state;
mod instructions;

use instructions::*;

declare_id!("6qffiegnidLpc17u11479LuQWaCLiWhhDDRtgcmLncRE");

#[program]
pub mod anchor_escrow {
    use super::*;

    pub fn make(ctx: Context<Make>, seed: u64, deposit: u64, receive: u64) -> Result<()> {
        ctx.accounts.init_escrow(seed, receive, &ctx.bumps)?;
        ctx.accounts.deposit(deposit)
    }
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        ctx.accounts.refund()
    }
}

#[derive(Accounts)]
pub struct Initialize {}

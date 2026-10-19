library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity cic_prefix is
  port (clk, rst, in_valid : in std_logic;
    in_i, in_q : in signed(23 downto 0);
    out_i, out_q : out signed(27 downto 0);
    out_valid : out std_logic);
end entity;
architecture rtl of cic_prefix is
  signal stage0_i, stage0_q : signed(27 downto 0);
  signal stage0_valid : std_logic;
  signal stage1_i, stage1_q : signed(27 downto 0);
  signal stage1_valid : std_logic;
  signal stage2_i, stage2_q : signed(27 downto 0);
  signal stage2_valid : std_logic;
begin
  stage_0 : entity work.cic_stage
    generic map (IN_BITS=>24, OUT_BITS=>28, REG_BITS=>29, R=>25, N=>1, M=>1, PHASE=>24, SHIFT=>2, ROUND_NEAREST=>true, SATURATE=>true)
    port map (clk=>clk, rst=>rst, in_valid=>in_valid, in_i=>in_i, in_q=>in_q,
              out_valid=>stage0_valid, out_i=>stage0_i, out_q=>stage0_q);
  stage_1 : entity work.cic_stage
    generic map (IN_BITS=>28, OUT_BITS=>28, REG_BITS=>33, R=>25, N=>1, M=>1, PHASE=>24, SHIFT=>6, ROUND_NEAREST=>true, SATURATE=>true)
    port map (clk=>clk, rst=>rst, in_valid=>stage0_valid, in_i=>stage0_i, in_q=>stage0_q,
              out_valid=>stage1_valid, out_i=>stage1_i, out_q=>stage1_q);
  stage_2 : entity work.cic_stage
    generic map (IN_BITS=>28, OUT_BITS=>28, REG_BITS=>35, R=>80, N=>1, M=>1, PHASE=>79, SHIFT=>8, ROUND_NEAREST=>true, SATURATE=>true)
    port map (clk=>clk, rst=>rst, in_valid=>stage1_valid, in_i=>stage1_i, in_q=>stage1_q,
              out_valid=>stage2_valid, out_i=>stage2_i, out_q=>stage2_q);
  out_i <= stage2_i; out_q <= stage2_q; out_valid <= stage2_valid;
end architecture;

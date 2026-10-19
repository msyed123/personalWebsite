library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity cic_chain is
 port(clk, rst, in_valid: in std_logic;
      in_i, in_q: in signed(23 downto 0);
      out_i, out_q: out signed(27 downto 0); out_valid: out std_logic);
end entity;
architecture rtl of cic_chain is
 constant B: positive := 28; constant CB: positive := 16;
 constant A: positive := 47; constant N: positive := 5;
 constant R: positive := 2; constant F: positive := 14;
 type coeff_array is array(0 to N-1) of signed(CB-1 downto 0);
 constant C: coeff_array := (0 => to_signed(645, CB), 1 => to_signed(4116, CB), 2 => to_signed(6862, CB), 3 => to_signed(4116, CB), 4 => to_signed(645, CB));
 type history_array is array(0 to N-2) of signed(B-1 downto 0);
 signal hi, hq: history_array := (others => (others => '0'));
 signal ci, cq: signed(B-1 downto 0); signal cv: std_logic;
 signal phase: natural range 0 to R-1 := 0;
 function rounded(x: signed(A-1 downto 0)) return signed is
  variable extended, mag, y: signed(A downto 0);
  variable maximum, minimum: signed(A downto 0);
 begin
  extended := resize(x,A+1); mag := abs(extended);
  y := shift_right(mag + shift_left(to_signed(1,A+1),F-1),F);
  if extended < 0 then y := -y; end if;
  maximum := shift_left(to_signed(1,A+1),B-1)-1;
  minimum := -shift_left(to_signed(1,A+1),B-1);
  if y > maximum then return resize(maximum,B);
  elsif y < minimum then return resize(minimum,B);
  else return resize(y,B); end if;
 end function;
begin
 prefix: entity work.cic_prefix port map(clk=>clk,rst=>rst,in_valid=>in_valid,
   in_i=>in_i,in_q=>in_q,out_i=>ci,out_q=>cq,out_valid=>cv);
 process(clk)
  variable ai, aq: signed(A-1 downto 0);
 begin
  if rising_edge(clk) then
   out_valid <= '0';
   if rst='1' then
    hi <= (others => (others => '0')); hq <= (others => (others => '0'));
    phase <= 0; out_i <= (others => '0'); out_q <= (others => '0');
   elsif cv='1' then
    if phase=R-1 then
     ai := resize(ci*C(0),A); aq := resize(cq*C(0),A);
     for k in 1 to N-1 loop
      ai := ai + resize(hi(k-1)*C(k),A); aq := aq + resize(hq(k-1)*C(k),A);
     end loop;
     out_i <= rounded(ai); out_q <= rounded(aq); out_valid <= '1'; phase <= 0;
    else phase <= phase+1; end if;
    for k in N-2 downto 1 loop hi(k) <= hi(k-1); hq(k) <= hq(k-1); end loop;
    hi(0) <= ci; hq(0) <= cq;
   end if;
  end if;
 end process;
end architecture;

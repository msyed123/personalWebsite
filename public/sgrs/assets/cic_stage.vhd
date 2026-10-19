library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

-- VHDL-2008. Signed I/Q, synchronous reset, sample enable, no backpressure.
entity cic_stage is
  generic (
    IN_BITS : positive := 16; OUT_BITS : positive := 16;
    REG_BITS : positive := 36; R : positive := 100;
    N : positive := 3; M : positive := 1;
    PHASE : natural := 99; SHIFT : natural := 20;
    ROUND_NEAREST : boolean := true; SATURATE : boolean := true
  );
  port (
    clk, rst, in_valid : in std_logic;
    in_i, in_q : in signed(IN_BITS-1 downto 0);
    out_valid : out std_logic;
    out_i, out_q : out signed(OUT_BITS-1 downto 0)
  );
end entity;

architecture rtl of cic_stage is
  subtype word_t is signed(REG_BITS-1 downto 0);
  subtype wide_t is signed(REG_BITS downto 0);
  type integrator_t is array (0 to 1, 0 to N-1) of word_t;
  type delay_t is array (0 to 1, 0 to N-1, 0 to M-1) of word_t;
  signal integrators : integrator_t;
  signal delays : delay_t;
  signal count : natural range 0 to R-1;
  constant ONE : wide_t := to_signed(1, REG_BITS+1);
  constant HI : wide_t := shift_left(ONE, OUT_BITS-1)-ONE;
  constant LO : wide_t := -shift_left(ONE, OUT_BITS-1);

  function format_output(raw : word_t) return signed is
    variable w : wide_t := resize(raw, REG_BITS+1);
    variable half : wide_t;
  begin
    if SHIFT > 0 then
      if ROUND_NEAREST then
        half := shift_left(ONE, SHIFT-1);
        if w < 0 then w := -shift_right(-w+half, SHIFT);
        else w := shift_right(w+half, SHIFT); end if;
      else w := shift_right(w, SHIFT); end if;
    end if;
    if SATURATE and w > HI then return HI(OUT_BITS-1 downto 0);
    elsif SATURATE and w < LO then return LO(OUT_BITS-1 downto 0);
    else return w(OUT_BITS-1 downto 0); end if;
  end function;
begin
  assert R >= 2 and PHASE < R and SHIFT < REG_BITS
    report "Invalid CIC ratio, phase or shift" severity failure;
  assert IN_BITS <= REG_BITS and OUT_BITS <= REG_BITS
    report "CIC registers must accommodate input and output widths" severity failure;

  process(clk)
    variable v, before_comb : word_t;
  begin
    if rising_edge(clk) then
      if rst = '1' then
        integrators <= (others => (others => (others => '0')));
        delays <= (others => (others => (others => (others => '0'))));
        count <= 0; out_valid <= '0';
        out_i <= (others => '0'); out_q <= (others => '0');
      else
        out_valid <= '0';
        if in_valid = '1' then
          if count = R-1 then count <= 0; else count <= count+1; end if;
          for c in 0 to 1 loop
            if c = 0 then v := resize(in_i, REG_BITS);
            else v := resize(in_q, REG_BITS); end if;
            for k in 0 to N-1 loop
              -- Same-width sums intentionally wrap. Each level uses the new sum.
              v := integrators(c,k)+v;
              integrators(c,k) <= v;
            end loop;
            if count = PHASE then
              for k in 0 to N-1 loop
                before_comb := v;
                v := v-delays(c,k,M-1);
                delays(c,k,0) <= before_comb;
                for d in 1 to M-1 loop delays(c,k,d) <= delays(c,k,d-1); end loop;
              end loop;
              if c = 0 then out_i <= format_output(v);
              else out_q <= format_output(v); end if;
            end if;
          end loop;
          if count = PHASE then out_valid <= '1'; end if;
        end if;
      end if;
    end if;
  end process;
end architecture;

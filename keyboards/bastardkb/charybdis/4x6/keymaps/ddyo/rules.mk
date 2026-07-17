VIA_ENABLE = yes
RAW_ENABLE = yes

RGB_MATRIX_SUPPORTED = no  # RGB matrix is supported and enabled by default.
RGBLIGHT_SUPPORTED = no    # RGB underglow is supported, but not enabled by default.
RGB_MATRIX_ENABLE = no     # Enable keyboard RGB matrix functionality


TAP_DANCE_ENABLE = yes
DYNAMIC_TAPPING_TERM_ENABLE = yes
COMBO_ENABLE = yes
CAPS_WORD_ENABLE = yes
MOUSEKEY_ENABLE = yes
NKRO_ENABLE = yes            # Enable N-Key Rollover
QMK_SETTINGS = yes
SPACE_CADET_ENABLE = no
CONSOLE_ENABLE = yes

SRC += analog.c

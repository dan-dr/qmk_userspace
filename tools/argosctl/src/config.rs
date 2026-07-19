use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, PartialEq)]
pub struct KeyboardInfo {
    pub argos_protocol_version: u16,
    pub tap_dance_amount: u8,
    pub combo_amount: u8,
    pub keys_per_combo: u8,
    pub theme_id: u8,
    pub qmk_keycodes_version: [u8; 3],
    pub has_displayed_welcome_message: bool,
    pub tapping_term: u16,
    pub combo_term: u16,
    pub is_left_handed: bool,
}

impl KeyboardInfo {
    pub fn parse(response: &[u8]) -> Result<Self, String> {
        let data = response
            .get(2..)
            .ok_or_else(|| "incomplete Argos keyboard-info response".to_owned())?;
        if data.len() < 15 {
            return Err("incomplete Argos keyboard-info response".to_owned());
        }

        let argos_protocol_version = u16::from_be_bytes([data[0], data[1]]);
        Ok(Self {
            argos_protocol_version,
            tap_dance_amount: data[2],
            combo_amount: data[3],
            keys_per_combo: data[4],
            theme_id: data[5],
            qmk_keycodes_version: [data[6], data[7], data[8]],
            has_displayed_welcome_message: data[9] == 1,
            tapping_term: u16::from_be_bytes([data[10], data[11]]),
            combo_term: u16::from_be_bytes([data[12], data[13]]),
            is_left_handed: data[14] == 1,
        })
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArgosConfig {
    pub via_protocol_version: u16,
    pub argos_protocol_version: u16,
    pub qmk_keycodes_version: [u8; 3],
    pub tap_dance_amount: u8,
    pub combo_amount: u8,
    pub keys_per_combo: u8,
    pub theme_id: u8,
    pub rgb_brightness: u8,
    pub rgb_effect_speed: u8,
    pub rgb_effect_type: u8,
    pub rgb_hue: u8,
    pub rgb_sat: u8,
    pub pointing_device_type: u8,
    #[serde(rename = "defaultDPI")]
    pub default_dpi: u16,
    pub minimum_default_dpi: u16,
    #[serde(rename = "defaultDPIConfigStep")]
    pub default_dpi_config_step: u16,
    #[serde(rename = "snipingDPI")]
    pub sniping_dpi: u16,
    #[serde(rename = "minimumSnipingDPI")]
    pub minimum_sniping_dpi: u16,
    #[serde(rename = "snipingDPIConfigStep")]
    pub sniping_dpi_config_step: u16,
    #[serde(rename = "defaultDPIMaxSteps")]
    pub default_dpi_max_steps: u8,
    #[serde(rename = "snipingDPIMaxSteps")]
    pub sniping_dpi_max_steps: u8,
    pub keycodes: Vec<Vec<u16>>,
    pub layer_names: Vec<String>,
    pub combos: Vec<Combo>,
    pub tap_dances: Vec<TapDance>,
    pub rows: usize,
    pub cols: usize,
    pub has_displayed_welcome_message: bool,
    pub tapping_term: u16,
    pub combo_term: u16,
    #[serde(rename = "isVIAOnly")]
    pub is_via_only: bool,
    pub is_left_handed: bool,
    #[serde(default)]
    pub auto_mouse_layer_enabled: bool,
    #[serde(default)]
    pub auto_precision_on_mouse_layer_enabled: bool,
    #[serde(default)]
    pub invert_x_axis_dragscroll: bool,
    #[serde(default)]
    pub invert_y_axis_dragscroll: bool,
    pub rgb_matrix: BTreeMap<String, RgbMatrixEntry>,
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Combo {
    pub enabled: bool,
    pub output: u16,
    pub input: Vec<u16>,
    pub custom_term: u16,
}

impl Combo {
    pub fn parse(response: &[u8], keys_per_combo: usize) -> Result<Self, String> {
        let data = response
            .get(2..)
            .ok_or_else(|| "incomplete Argos combo response".to_owned())?;
        let required = 6 + keys_per_combo * 2;
        if data.len() < required {
            return Err("incomplete Argos combo response".to_owned());
        }

        let mut input = Vec::with_capacity(keys_per_combo);
        let mut found_empty = false;
        for index in 0..keys_per_combo {
            let offset = 6 + index * 2;
            let keycode = u16::from_le_bytes([data[offset], data[offset + 1]]);
            found_empty |= keycode == 0;
            input.push(if found_empty { 0 } else { keycode });
        }

        Ok(Self {
            enabled: data[1] != 0,
            output: u16::from_le_bytes([data[2], data[3]]),
            custom_term: u16::from_le_bytes([data[4], data[5]]),
            input,
        })
    }
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
pub struct TapDance {
    pub on_tap: u16,
    pub on_hold: u16,
    pub on_double_tap: u16,
    pub on_tap_hold: u16,
    pub custom_tapping_term: u16,
}

impl TapDance {
    pub fn parse(response: &[u8]) -> Result<Self, String> {
        let data = response
            .get(2..)
            .ok_or_else(|| "incomplete Argos tap-dance response".to_owned())?;
        if data.len() < 11 {
            return Err("incomplete Argos tap-dance response".to_owned());
        }
        Ok(Self {
            on_tap: u16::from_le_bytes([data[1], data[2]]),
            on_hold: u16::from_le_bytes([data[3], data[4]]),
            on_double_tap: u16::from_le_bytes([data[5], data[6]]),
            on_tap_hold: u16::from_le_bytes([data[7], data[8]]),
            custom_tapping_term: u16::from_le_bytes([data[9], data[10]]),
        })
    }
}

#[derive(Debug, Default, Deserialize, Serialize)]
pub struct RgbMatrixEntry {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub transparent: bool,
    pub on: bool,
    pub custom: bool,
}

#[derive(Debug, Default)]
pub struct PointingDeviceInfo {
    pub pointing_device_type: u8,
    pub default_dpi: u16,
    pub minimum_default_dpi: u16,
    pub default_dpi_config_step: u16,
    pub sniping_dpi: u16,
    pub minimum_sniping_dpi: u16,
    pub sniping_dpi_config_step: u16,
    pub default_dpi_max_steps: u8,
    pub sniping_dpi_max_steps: u8,
    pub auto_mouse_layer_enabled: bool,
    pub auto_precision_on_mouse_layer_enabled: bool,
    pub invert_x_axis_dragscroll: bool,
    pub invert_y_axis_dragscroll: bool,
}

impl PointingDeviceInfo {
    pub fn parse(response: &[u8]) -> Result<Self, String> {
        let data = response
            .get(2..)
            .ok_or_else(|| "incomplete Argos pointing-device response".to_owned())?;
        if data.len() < 15 {
            return Err("incomplete Argos pointing-device response".to_owned());
        }
        Ok(Self {
            pointing_device_type: data[0],
            default_dpi: u16::from_le_bytes([data[1], data[2]]),
            minimum_default_dpi: u16::from_le_bytes([data[3], data[4]]),
            default_dpi_config_step: u16::from_le_bytes([data[5], data[6]]),
            sniping_dpi: u16::from_le_bytes([data[7], data[8]]),
            minimum_sniping_dpi: u16::from_le_bytes([data[9], data[10]]),
            sniping_dpi_config_step: u16::from_le_bytes([data[11], data[12]]),
            default_dpi_max_steps: data[13],
            sniping_dpi_max_steps: data[14],
            auto_mouse_layer_enabled: data.get(15).copied() == Some(1),
            auto_precision_on_mouse_layer_enabled: data.get(16).copied() == Some(1),
            invert_x_axis_dragscroll: data.get(17).copied() == Some(1),
            invert_y_axis_dragscroll: data.get(18).copied() == Some(1),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_keyboard_info() {
        let response = [
            0x90, 0x01, 0, 4, 50, 16, 4, 13, 0, 0, 8, 1, 0, 175, 0, 42, 1, 1, 0,
        ];
        let info = KeyboardInfo::parse(&response).unwrap();
        assert_eq!(info.argos_protocol_version, 4);
        assert_eq!(info.tapping_term, 175);
        assert_eq!(info.combo_term, 42);
        assert!(info.is_left_handed);
    }

    #[test]
    fn parses_combo_and_discards_keys_after_first_empty_slot() {
        let response = [
            0x90, 0x02, 3, 1, 0x34, 0x12, 0x2a, 0, 4, 0, 5, 0, 0, 0, 7, 0,
        ];
        assert_eq!(
            Combo::parse(&response, 4).unwrap(),
            Combo {
                enabled: true,
                output: 0x1234,
                input: vec![4, 5, 0, 0],
                custom_term: 42,
            }
        );
    }

    #[test]
    fn preserves_reported_disabled_combo_state() {
        let response = [0x90, 0x02, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        assert_eq!(
            Combo::parse(&response, 4).unwrap(),
            Combo {
                enabled: false,
                output: 0,
                input: vec![0, 0, 0, 0],
                custom_term: 0,
            }
        );
    }

    #[test]
    fn parses_tap_dance() {
        let response = [0x90, 0x07, 2, 4, 0, 5, 0, 6, 0, 7, 0, 175, 0];
        assert_eq!(
            TapDance::parse(&response).unwrap(),
            TapDance {
                on_tap: 4,
                on_hold: 5,
                on_double_tap: 6,
                on_tap_hold: 7,
                custom_tapping_term: 175,
            }
        );
    }

    #[test]
    fn parses_protocol_four_pointer_flags_from_pointing_info() {
        let response = [
            0x90, 0x0c, 2, 0x58, 0x02, 0x90, 0x01, 0xc8, 0x00, 0xc8, 0x00, 0xc8, 0x00, 0x64, 0x00,
            16, 4, 1, 0, 1, 0,
        ];
        let info = PointingDeviceInfo::parse(&response).unwrap();

        assert_eq!(info.default_dpi, 600);
        assert!(info.auto_mouse_layer_enabled);
        assert!(!info.auto_precision_on_mouse_layer_enabled);
        assert!(info.invert_x_axis_dragscroll);
        assert!(!info.invert_y_axis_dragscroll);
    }
}

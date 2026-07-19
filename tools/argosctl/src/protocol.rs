use crate::config::{Combo, KeyboardInfo, PointingDeviceInfo, TapDance};
use hidapi::{HidApi, HidDevice};
use std::thread;
use std::time::{Duration, Instant};

const RAW_HID_REPORT_SIZE: usize = 32;
const VIA_USAGE_PAGE: u16 = 0xff60;
const VIA_USAGE: u16 = 0x61;
const ARGOS_PREFIX: u8 = 0x90;
const ARGOS_SET_TAP_DANCE: u8 = 0x08;
const ARGOS_SET_COMBO: u8 = 0x0e;
const DDYO_GET_IS_RIGHT_HALF: [u8; 3] = [0x08, 0x00, 0xDD];
const RESPONSE_TIMEOUT: Duration = Duration::from_secs(3);

pub struct ArgosDevice {
    device: HidDevice,
}

impl ArgosDevice {
    pub fn open(vid: u16, pid: u16) -> Result<Self, String> {
        let api = HidApi::new().map_err(|error| format!("could not initialize HID: {error}"))?;
        let paths: Vec<_> = api
            .device_list()
            .filter(|device| {
                device.vendor_id() == vid
                    && device.product_id() == pid
                    && device.usage_page() == VIA_USAGE_PAGE
                    && device.usage() == VIA_USAGE
            })
            .map(|device| device.path().to_owned())
            .collect();

        match paths.as_slice() {
            [] => Err(format!(
                "no Argos Raw HID device found for {vid:04X}:{pid:04X}; connect the keyboard over USB and close Argos if it has the device open"
            )),
            [path] => api
                .open_path(path)
                .map(|device| Self { device })
                .map_err(|error| format!("could not open Argos Raw HID device: {error}")),
            _ => Err(format!(
                "found {} Argos Raw HID devices for {vid:04X}:{pid:04X}; connect only one matching keyboard",
                paths.len()
            )),
        }
    }

    pub fn via_protocol_version(&self) -> Result<u16, String> {
        let response = self.via_command(0x01, &[])?;
        Ok(u16::from_be_bytes([response[1], response[2]]))
    }

    pub fn layer_count(&self) -> Result<usize, String> {
        let response = self.via_command(0x11, &[])?;
        let count = response[1] as usize;
        if count == 0 {
            return Err("keyboard reported zero dynamic keymap layers".to_owned());
        }
        Ok(count)
    }

    pub fn keymap(&self, layers: usize, rows: usize, cols: usize) -> Result<Vec<Vec<u16>>, String> {
        let layer_size = rows
            .checked_mul(cols)
            .ok_or_else(|| "keymap dimensions overflowed".to_owned())?;
        let byte_count = layers
            .checked_mul(layer_size)
            .and_then(|count| count.checked_mul(2))
            .ok_or_else(|| "keymap size overflowed".to_owned())?;
        if byte_count > u16::MAX as usize {
            return Err("keymap is too large for the VIA buffer protocol".to_owned());
        }

        let mut bytes = Vec::with_capacity(byte_count);
        for offset in (0..byte_count).step_by(22) {
            let size = (byte_count - offset).min(22);
            let [offset_hi, offset_lo] = (offset as u16).to_be_bytes();
            let response = self.via_command(0x12, &[offset_hi, offset_lo, size as u8])?;
            bytes.extend_from_slice(&response[4..4 + size]);
        }

        let keycodes: Vec<u16> = bytes
            .chunks_exact(2)
            .map(|bytes| u16::from_be_bytes([bytes[0], bytes[1]]))
            .collect();
        Ok(keycodes
            .chunks_exact(layer_size)
            .map(<[u16]>::to_vec)
            .collect())
    }

    pub fn set_keymap(
        &self,
        keycodes: &[Vec<u16>],
        rows: usize,
        cols: usize,
    ) -> Result<(), String> {
        let layer_size = rows
            .checked_mul(cols)
            .ok_or_else(|| "keymap dimensions overflowed".to_owned())?;
        let mut bytes = Vec::with_capacity(keycodes.len() * layer_size * 2);
        for (layer, keycodes) in keycodes.iter().enumerate() {
            if keycodes.len() != layer_size {
                return Err(format!(
                    "layer {layer} has {} keycodes; expected {layer_size}",
                    keycodes.len()
                ));
            }
            for keycode in keycodes {
                bytes.extend_from_slice(&keycode.to_be_bytes());
            }
        }
        if bytes.len() > u16::MAX as usize {
            return Err("keymap is too large for the VIA buffer protocol".to_owned());
        }

        for offset in (0..bytes.len()).step_by(28) {
            let size = (bytes.len() - offset).min(28);
            let [offset_hi, offset_lo] = (offset as u16).to_be_bytes();
            let mut data = Vec::with_capacity(size + 3);
            data.extend_from_slice(&[offset_hi, offset_lo, size as u8]);
            data.extend_from_slice(&bytes[offset..offset + size]);
            self.via_command(0x13, &data)?;
        }
        Ok(())
    }

    pub fn keyboard_info(&self) -> Result<KeyboardInfo, String> {
        KeyboardInfo::parse(&self.argos_command(0x01, &[])?)
    }

    pub fn physical_half_is_right(&self) -> Result<bool, String> {
        let response = self
            .command(&DDYO_GET_IS_RIGHT_HALF, &DDYO_GET_IS_RIGHT_HALF)
            .map_err(|error| {
                format!("could not read physical right-half state from ddyo keymap: {error}")
            })?;
        parse_is_right_half(response[DDYO_GET_IS_RIGHT_HALF.len()])
    }

    pub fn combos(&self, count: u8, keys_per_combo: u8) -> Result<Vec<Combo>, String> {
        (0..count)
            .map(|index| {
                self.argos_command(0x02, &[index])
                    .and_then(|response| Combo::parse(&response, keys_per_combo as usize))
                    .map_err(|error| format!("could not read combo {index}: {error}"))
            })
            .collect()
    }

    pub fn tap_dances(&self, count: u8) -> Result<Vec<TapDance>, String> {
        (0..count)
            .map(|index| {
                self.argos_command(0x07, &[index])
                    .and_then(|response| TapDance::parse(&response))
                    .map_err(|error| format!("could not read tap dance {index}: {error}"))
            })
            .collect()
    }

    pub fn pointing_device_info(&self) -> Result<PointingDeviceInfo, String> {
        PointingDeviceInfo::parse(&self.argos_command(0x0c, &[])?)
    }

    pub fn set_theme_id(&self, theme_id: u8) -> Result<(), String> {
        self.argos_command(0x06, &[theme_id]).map(|_| ())
    }

    pub fn set_welcome_message_displayed(&self, displayed: bool) -> Result<(), String> {
        self.argos_command(0x10, &[u8::from(displayed)]).map(|_| ())
    }

    pub fn set_tapping_term(&self, term: u16) -> Result<(), String> {
        self.argos_command(0x11, &term.to_be_bytes()).map(|_| ())
    }

    pub fn set_combo_term(&self, term: u16) -> Result<(), String> {
        self.argos_command(0x12, &term.to_be_bytes()).map(|_| ())
    }

    pub fn set_default_dpi(&self, dpi: u16) -> Result<(), String> {
        self.argos_command(0x0b, &dpi.to_le_bytes()).map(|_| ())
    }

    pub fn set_sniping_dpi(&self, dpi: u16) -> Result<(), String> {
        self.argos_command(0x0d, &dpi.to_le_bytes()).map(|_| ())
    }

    pub fn set_combo(&self, index: u8, combo: &Combo) -> Result<(), String> {
        let data = set_combo_payload(index, combo)?;
        self.argos_command(ARGOS_SET_COMBO, &data).map(|_| ())
    }

    pub fn set_tap_dance(&self, index: u8, tap_dance: &TapDance) -> Result<(), String> {
        let data = set_tap_dance_payload(index, tap_dance);
        self.argos_command(ARGOS_SET_TAP_DANCE, &data).map(|_| ())
    }

    fn via_command(&self, command: u8, data: &[u8]) -> Result<[u8; 32], String> {
        let mut request = Vec::with_capacity(data.len() + 1);
        request.push(command);
        request.extend_from_slice(data);
        self.command(&request, &request)
    }

    fn argos_command(&self, command: u8, data: &[u8]) -> Result<[u8; 32], String> {
        let mut request = Vec::with_capacity(data.len() + 2);
        request.extend_from_slice(&[ARGOS_PREFIX, command]);
        request.extend_from_slice(data);
        self.command(&request, &[ARGOS_PREFIX, command])
    }

    fn command(&self, request: &[u8], response_prefix: &[u8]) -> Result<[u8; 32], String> {
        if request.len() > RAW_HID_REPORT_SIZE {
            return Err("Raw HID request exceeds 32 bytes".to_owned());
        }

        let mut report = [0u8; RAW_HID_REPORT_SIZE + 1];
        report[1..=request.len()].copy_from_slice(request);
        let written = self
            .device
            .write(&report)
            .map_err(|error| format!("Raw HID write failed: {error}"))?;
        if written != report.len() {
            return Err(format!(
                "Raw HID write was incomplete: wrote {written} of {} bytes",
                report.len()
            ));
        }

        let deadline = Instant::now() + RESPONSE_TIMEOUT;
        while Instant::now() < deadline {
            let mut response = [0u8; RAW_HID_REPORT_SIZE];
            let read = self
                .device
                .read_timeout(&mut response, 200)
                .map_err(|error| format!("Raw HID read failed: {error}"))?;
            if read == 0 {
                continue;
            }
            if response[..read].starts_with(response_prefix) {
                return Ok(response);
            }
            thread::yield_now();
        }

        Err(format!(
            "timed out waiting for Raw HID response to {}; close Argos and KeyPeek, then retry",
            hex_bytes(response_prefix)
        ))
    }
}

fn set_combo_payload(index: u8, combo: &Combo) -> Result<Vec<u8>, String> {
    if combo.custom_term != 0 {
        return Err(format!(
            "combo {index} has unsupported custom term {}",
            combo.custom_term
        ));
    }

    let mut data = Vec::with_capacity(3 + combo.input.len() * 2);
    data.push(index);
    data.extend_from_slice(&combo.output.to_be_bytes());
    for keycode in &combo.input {
        data.extend_from_slice(&keycode.to_be_bytes());
    }
    Ok(data)
}

fn set_tap_dance_payload(index: u8, tap_dance: &TapDance) -> Vec<u8> {
    let mut data = Vec::with_capacity(11);
    data.push(index);
    data.extend_from_slice(&tap_dance.on_tap.to_be_bytes());
    data.extend_from_slice(&tap_dance.on_hold.to_be_bytes());
    data.extend_from_slice(&tap_dance.on_double_tap.to_be_bytes());
    data.extend_from_slice(&tap_dance.on_tap_hold.to_be_bytes());
    data.extend_from_slice(&tap_dance.custom_tapping_term.to_be_bytes());
    data
}

fn parse_is_right_half(value: u8) -> Result<bool, String> {
    match value {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(format!(
            "keyboard reported invalid physical right-half state {value}"
        )),
    }
}

fn hex_bytes(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| format!("0x{byte:02X}"))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_combo_like_the_live_website() {
        let combo = Combo {
            enabled: true,
            output: 0x1234,
            input: vec![0x0004, 0x5678, 0, 0],
            custom_term: 0,
        };

        assert_eq!(
            set_combo_payload(3, &combo).unwrap(),
            [3, 0x12, 0x34, 0x00, 0x04, 0x56, 0x78, 0, 0, 0, 0]
        );
    }

    #[test]
    fn ignores_read_only_combo_enabled_state_like_the_live_website() {
        let disabled = Combo {
            enabled: false,
            output: 0x1234,
            input: vec![0x0004, 0x5678, 0, 0],
            custom_term: 0,
        };
        assert_eq!(
            set_combo_payload(3, &disabled).unwrap(),
            [3, 0x12, 0x34, 0x00, 0x04, 0x56, 0x78, 0, 0, 0, 0]
        );
    }

    #[test]
    fn rejects_unsupported_combo_custom_term() {
        let combo = Combo {
            enabled: true,
            output: 0,
            input: vec![0, 0, 0, 0],
            custom_term: 42,
        };
        assert!(set_combo_payload(0, &combo).is_err());
    }

    #[test]
    fn encodes_tap_dance_like_the_live_website() {
        let tap_dance = TapDance {
            on_tap: 0x1234,
            on_hold: 0x5678,
            on_double_tap: 0x9abc,
            on_tap_hold: 0xdef0,
            custom_tapping_term: 0x00af,
        };

        assert_eq!(
            set_tap_dance_payload(2, &tap_dance),
            [2, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x00, 0xaf]
        );
    }

    #[test]
    fn parses_keymap_right_half_response() {
        assert!(!parse_is_right_half(0).unwrap());
        assert!(parse_is_right_half(1).unwrap());
        assert!(parse_is_right_half(2).is_err());
    }
}

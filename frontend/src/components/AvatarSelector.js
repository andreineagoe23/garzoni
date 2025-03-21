// src/components/AvatarSelector.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Button, Modal, Form, Row, Col } from "react-bootstrap";
import "../styles/scss/main.scss";

function AvatarSelector({ currentAvatar, onAvatarChange }) {
  const [show, setShow] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("avataaars");
  const [seed, setSeed] = useState("");
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const avatarStyles = [
    { id: "avataaars", name: "People" },
    { id: "bottts", name: "Robots" },
    { id: "initials", name: "Initials" },
    { id: "micah", name: "Micah" },
    { id: "adventurer", name: "Adventurer" },
    { id: "funEmoji", name: "Emoji" }, 
    { id: "pixelArt", name: "Pixel Art" },
  ];

  const handleClose = () => setShow(false);
  const handleShow = () => {

    if (!seed && currentAvatar) {

      const match = currentAvatar.match(
        /avatars\.dicebear\.com\/(?:api|7\.x)\/([^/]+)\/([^.]+)/
      );
      if (match && match.length >= 3) {
        setSelectedStyle(match[1]);
        setSeed(match[2]);
      } else {
        // Default to username or random string
        setSeed(Math.random().toString(36).substring(2, 8));
      }
    }
    setShow(true);
  };

  const handleStyleChange = (e) => {
    setSelectedStyle(e.target.value);
  };

  const handleSeedChange = (e) => {
    setSeed(e.target.value);
  };

  useEffect(() => {
    if (selectedStyle && seed) {
      updatePreview(selectedStyle, seed);
    }
  }, [selectedStyle, seed]);

  const updatePreview = (style, seedValue) => {
    if (!seedValue) return;

    setPreviewAvatar(
      `https://api.dicebear.com/7.x/${style}/svg?seed=${seedValue}`
    );
  };

  const handleSaveAvatar = async () => {
    setIsLoading(true);
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/update-avatar/`,
        { profile_avatar: previewAvatar },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      onAvatarChange(previewAvatar);
      handleClose();
    } catch (error) {
      console.error("Error updating avatar:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateRandomExamples = () => {
    const examples = [];
    for (let i = 0; i < 6; i++) {
      const randomSeed = Math.random().toString(36).substring(2, 8);
      examples.push({
        seed: randomSeed,
        // Updated DiceBear API v7 URL format
        url: `https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${randomSeed}`,
      });
    }
    return examples;
  };

  const randomExamples = generateRandomExamples();

  const selectExample = (exampleSeed) => {
    setSeed(exampleSeed);
  };

  return (
    <div className="avatar-selector">
      <Button
        variant="outline-primary"
        onClick={handleShow}
        className="avatar-selector__trigger"
      >
        <i className="bi bi-pencil"></i>
      </Button>

      <Modal show={show} onHide={handleClose} centered size="lg">
        <Modal.Header closeButton className="avatar-selector__header">
          <Modal.Title className="avatar-selector__title">
            Customize Your Avatar
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="avatar-selector__body">
          <div className="avatar-selector__preview-container">
            <img
              src={previewAvatar}
              alt="Avatar Preview"
              width="150"
              height="150"
              className="avatar-selector__preview"
            />
          </div>

          <Form className="avatar-selector__form">
            <Form.Group className="avatar-selector__form-group">
              <Form.Label className="avatar-selector__label">
                Avatar Style
              </Form.Label>
              <Form.Select
                className="avatar-selector__select"
                value={selectedStyle}
                onChange={handleStyleChange}
              >
                {avatarStyles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="avatar-selector__form-group">
              <Form.Label className="avatar-selector__label">
                Customization Seed
              </Form.Label>
              <Form.Control
                className="avatar-selector__input"
                type="text"
                value={seed}
                onChange={handleSeedChange}
                placeholder="Enter text to customize your avatar"
              />
              <Form.Text className="avatar-selector__help-text">
                Different text creates different avatars
              </Form.Text>
            </Form.Group>
          </Form>

          <div className="avatar-selector__quick-options">
            <h5 className="avatar-selector__options-title">Quick Options</h5>
            <p className="avatar-selector__options-subtitle">
              Click an avatar to select it:
            </p>
            <Row className="avatar-selector__examples">
              {randomExamples.map((example, index) => (
                <Col
                  xs={4}
                  sm={2}
                  key={index}
                  className="avatar-selector__example-col"
                >
                  <img
                    src={example.url}
                    alt={`Example ${index + 1}`}
                    width="60"
                    height="60"
                    className={`avatar-selector__example ${
                      seed === example.seed ? "avatar-selector__example--selected" : ""
                    }`}
                    onClick={() => selectExample(example.seed)}
                  />
                </Col>
              ))}
            </Row>
          </div>
        </Modal.Body>
        <Modal.Footer className="avatar-selector__footer">
          <Button
            variant="secondary"
            className="avatar-selector__cancel"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            className="avatar-selector__save"
            onClick={handleSaveAvatar}
            disabled={isLoading || !previewAvatar}
          >
            {isLoading ? "Saving..." : "Save Avatar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default AvatarSelector;
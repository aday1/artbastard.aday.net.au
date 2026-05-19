I've identified the issue! The **Scenes & Acts** page uses the `SceneGallery` component, not `ScenePanel`. 

The SceneGallery already has an "Edit" button, but it only allows editing the scene **name** and **OSC address** - not the actual channel values/sliders.

I need to add inline channel value editing to SceneGallery. This will require:

1. Adding state to track which scene is being edited for channel values
2. Adding state to store the editing channel values
3. Adding the inline slider editor UI (similar to ScenePanel)
4. Adding handlers to save the edited channel values

Let me implement this now...

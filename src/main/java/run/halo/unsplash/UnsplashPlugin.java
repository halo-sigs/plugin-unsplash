package run.halo.unsplash;

import org.springframework.stereotype.Component;

import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;

/**
 * @author ryanwang
 * @since 2.0.0
 */
@Component
public class UnsplashPlugin extends BasePlugin {

    public UnsplashPlugin(PluginContext context) {
        super(context);
    }

}
